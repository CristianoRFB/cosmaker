import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireVerifiedIdentity } from './access';

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
  if (call.data !== undefined && call.data !== null && (typeof call.data !== 'object' || Array.isArray(call.data) || Object.keys(call.data).length)) throw new HttpsError('invalid-argument', 'A consulta usa apenas sua identidade autenticada.');
  const uid = call.auth!.uid;
  if (typeof identity.email !== 'string') throw new HttpsError('failed-precondition', 'Sua conta precisa de e-mail verificado.');
  const email = identity.email.trim().toLowerCase();
  return adminDb.runTransaction(async (transaction) => {
    const profile = await transaction.get(adminDb.doc(`users/${uid}`));
    if (profile.get('active') !== true || profile.get('accountType') !== 'client') throw new HttpsError('permission-denied', 'Sua conta não tem um perfil de cliente ativo.');
    const [byUid, byEmail] = await Promise.all([
      transaction.get(adminDb.collectionGroup('orders').where('clientUserId', '==', uid).orderBy('createdAt', 'desc').limit(51)),
      transaction.get(adminDb.collectionGroup('orders').where('email', '==', email).orderBy('createdAt', 'desc').limit(51)),
    ]);
    const candidates = [...new Map([...byUid.docs, ...byEmail.docs].map((snapshot) => [snapshot.ref.path, snapshot])).values()]
      .filter((snapshot) => { const path = snapshot.ref.path.split('/'); return path.length === 4 && path[0] === 'ateliers' && path[2] === 'orders' && safeId(path[1]); });
    const paths = new Set<string>();
    for (const candidate of candidates) {
      const atelierId = candidate.ref.path.split('/')[1];
      paths.add(`ateliers/${atelierId}`);
      if (safeId(candidate.get('clientId'))) paths.add(`ateliers/${atelierId}/clients/${candidate.get('clientId')}`);
    }
    const records = paths.size ? await transaction.getAll(...[...paths].map((path) => adminDb.doc(path))) : [];
    const values = new Map(records.map((snapshot) => [snapshot.ref.path, snapshot.data()]));
    const orders = candidates.flatMap((snapshot) => {
      const atelierId = snapshot.ref.path.split('/')[1];
      const data = snapshot.data();
      if (data.clientId !== undefined && data.clientId !== null && !safeId(data.clientId)) return [];
      if (values.get(`ateliers/${atelierId}`)?.active !== true || (data.atelierId !== undefined && data.atelierId !== atelierId)) return [];
      const clientUid = safeId(data.clientId) ? values.get(`ateliers/${atelierId}/clients/${data.clientId}`)?.userId : null;
      const orderUid = typeof data.clientUserId === 'string' ? data.clientUserId : null;
      const linkedUid = orderUid ?? (typeof clientUid === 'string' ? clientUid : null);
      if (linkedUid === '') return [];
      if ((orderUid && typeof clientUid === 'string' && orderUid !== clientUid) || (linkedUid ? linkedUid !== uid : typeof data.email !== 'string' || data.email.toLowerCase() !== email)) return [];
      const createdAt = data.createdAt && typeof data.createdAt.toMillis === 'function' ? data.createdAt.toMillis() : 0;
      return [{ sortTime: createdAt, value: { ...pick(data, publicFields), id: snapshot.id, atelierId,
        approvedQuoteSnapshot: pick(data.approvedQuoteSnapshot, ['total', 'depositAmount', 'depositPercentage', 'expectedStartDate', 'expectedCompletionDate']),
        ...(data.currentAgreement ? { currentAgreement: pick(data.currentAgreement, agreementFields) } : {}),
        createdAt: createdAt ? new Date(createdAt).toISOString() : null,
      } }];
    }).sort((first, second) => second.sortTime - first.sortTime || first.value.id.localeCompare(second.value.id));
    return { orders: orders.slice(0, 50).map(({ value }) => value), hasMore: orders.length > 50 };
  });
});
