import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireVerifiedIdentity } from './access';
import { visibleClientRecords } from '../clients/client-visibility';

const publicFields = ['quoteId', 'requestId', 'clientId', 'clientName', 'email', 'character', 'franchise', 'category', 'description', 'status', 'priority', 'progress', 'amountPaid', 'amountRemaining', 'amountPaidCents', 'amountRemainingCents', 'totalAmountCents', 'agreementVersion', 'planningNeedsReview', 'expectedDeliveryDate', 'eventDate'];
const agreementFields = ['version', 'sourceQuoteId', 'scope', 'materials', 'expectedDeliveryDate', 'totalCents', 'depositAmountCents'];
function pick(value: unknown, fields: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(fields.filter((key) => record[key] !== undefined).map((key) => [key, record[key]]));
}
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);

/** The verified email finds legacy candidates; an existing UID always determines ownership. */
export const listClientOrders = onCall(async (call) => {
  const identity = requireVerifiedIdentity(call.auth);
  if (call.data !== undefined && call.data !== null && (typeof call.data !== 'object' || Array.isArray(call.data) || Object.keys(call.data).some(key => key !== 'cursor'))) throw new HttpsError('invalid-argument', 'A consulta usa apenas sua identidade autenticada.');
  const cursor = call.data?.cursor;
  let cursorPath: string | null = null;
  if (cursor !== undefined) {
    if (typeof cursor !== 'string' || cursor.length > 1500) throw new HttpsError('invalid-argument', 'Página de pedidos inválida.');
    cursorPath = Buffer.from(cursor, 'base64url').toString();
    const parts = cursorPath.split('/');
    if (parts.length !== 4 || parts[0] !== 'ateliers' || parts[2] !== 'orders' || !safeId(parts[1]) || !safeId(parts[3]) || Buffer.from(cursorPath).toString('base64url') !== cursor) throw new HttpsError('invalid-argument', 'Página de pedidos inválida.');
  }
  const uid = call.auth!.uid;
  if (typeof identity.email !== 'string') throw new HttpsError('failed-precondition', 'Sua conta precisa de e-mail verificado.');
  const email = identity.email.trim().toLowerCase();
  return adminDb.runTransaction(async (transaction) => {
    const profile = await transaction.get(adminDb.doc(`users/${uid}`));
    if (profile.get('active') !== true || profile.get('accountType') !== 'client') throw new HttpsError('permission-denied', 'Sua conta não tem um perfil de cliente ativo.');
    const [byUid, byEmail, linkedClients] = await Promise.all([
      transaction.get(adminDb.collectionGroup('orders').where('clientUserId', '==', uid).limit(501)),
      transaction.get(adminDb.collectionGroup('orders').where('email', '==', email).limit(501)),
      transaction.get(adminDb.collectionGroup('clients').where('userId', '==', uid).limit(101)),
    ]);
    if (byUid.size > 500 || byEmail.size > 500 || linkedClients.size > 100) throw new HttpsError('resource-exhausted', 'O histórico precisa de uma consulta assistida pelo ateliê.');
    const ownClients = linkedClients.docs.filter(client => { const parts = client.ref.path.split('/'); return parts.length === 4 && parts[0] === 'ateliers' && parts[2] === 'clients' && safeId(parts[1]); });
    const linked = await Promise.all(ownClients.map(client => transaction.get(client.ref.parent.parent!.collection('orders').where('clientId', '==', client.id).limit(501))));
    if (linked.some(result => result.size > 500)) throw new HttpsError('resource-exhausted', 'O histórico precisa de uma consulta assistida pelo ateliê.');
    const candidates = [...new Map([...byUid.docs, ...byEmail.docs, ...linked.flatMap(result => result.docs)].map(snapshot => [snapshot.ref.path, snapshot])).values()];
    if (candidates.length > 1000) throw new HttpsError('resource-exhausted', 'O histórico precisa de uma consulta assistida pelo ateliê.');
    const visible = await visibleClientRecords(transaction, { uid, email }, candidates, 'orders');
    const orders = visible.map(snapshot => {
      const atelierId = snapshot.ref.path.split('/')[1]; const data = snapshot.data()!;
      const createdAt = data.createdAt && typeof data.createdAt.toMillis === 'function' ? data.createdAt.toMillis() : 0;
      return { path: snapshot.ref.path, sortTime: createdAt, value: { ...pick(data, publicFields), id: snapshot.id, atelierId,
        approvedQuoteSnapshot: pick(data.approvedQuoteSnapshot, ['total', 'depositAmount', 'depositPercentage', 'expectedStartDate', 'expectedCompletionDate']),
        ...(data.currentAgreement ? { currentAgreement: pick(data.currentAgreement, agreementFields) } : {}),
        createdAt: createdAt ? new Date(createdAt).toISOString() : null,
      } };
    }).sort((first, second) => second.sortTime - first.sortTime || first.path.localeCompare(second.path));
    const index = cursorPath ? orders.findIndex(order => order.path === cursorPath) : -1;
    if (cursorPath && index < 0) throw new HttpsError('failed-precondition', 'A página de pedidos mudou. Atualize a lista.');
    const page = orders.slice(index + 1, index + 51); const hasMore = orders.length > index + 51;
    return { orders: page.map(({ value }) => value), hasMore, nextCursor: hasMore ? Buffer.from(page.at(-1)!.path).toString('base64url') : null };
  });
});
