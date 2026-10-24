import { FieldPath } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { messageActor, messageId, messageInput } from '../messages/access';
import { financialOrder, cents } from '../finance/policy';
import { moneyToCents } from './change-policy';
import { identity } from './order-file-bytes';

const iso = (value: unknown) => value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function'
  ? value.toDate().toISOString() as string : typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;

function projectPayment(snapshot: FirebaseFirestore.DocumentSnapshot) {
  const data = snapshot.data()!;
  try {
    const amountCents = data.amountCents === undefined ? moneyToCents(data.amount) : cents(data.amountCents);
    if (data.amount !== undefined && moneyToCents(data.amount) !== amountCents) throw new Error('inconsistent');
    if (!['deposit', 'installment', 'final', 'refund'].includes(data.type) || !['pending', 'generated', 'paid', 'overdue', 'cancelled', 'refunded'].includes(data.status)) throw new Error('invalid');
    return { id: snapshot.id, type: data.type as string, amountCents, amount: amountCents / 100, status: data.status as string,
      method: ['pix', 'bank_transfer', 'cash', 'card', 'other'].includes(data.method) ? data.method as string : null,
      dueDate: typeof data.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.dueDate) ? data.dueDate : null,
      effectiveDate: typeof data.effectiveDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.effectiveDate) ? data.effectiveDate : null,
      paidAt: iso(data.paidAt), createdAt: iso(data.createdAt), reversedAt: iso(data.reversedAt) };
  } catch { throw new HttpsError('failed-precondition', 'Um registro financeiro precisa de conferência pelo ateliê.'); }
}

async function readPayments(call: CallableRequest, detail: boolean) {
  const session = await identity(call.rawRequest);
  if (session.uid !== call.auth?.uid) throw new HttpsError('unauthenticated', 'Entre novamente para consultar seus registros.');
  const data = messageInput(call.data ?? {}, detail ? ['atelierId', 'orderId', 'paymentId'] : ['atelierId', 'orderId', 'cursor']);
  if (!messageId(data.atelierId) || !messageId(data.orderId) || (detail && !messageId(data.paymentId))
    || (data.cursor !== undefined && !messageId(data.cursor))) throw new HttpsError('invalid-argument', 'Pedido ou registro inválido.');
  const atelierId = data.atelierId; const orderId = data.orderId;
  return adminDb.runTransaction(async tx => {
    const actor = await messageActor(tx, call.auth, atelierId, orderId);
    if (actor.staff) throw new HttpsError('permission-denied', 'Use o financeiro do ateliê para consultar seus registros administrativos.');
    let balance;
    try { balance = financialOrder(actor.order); }
    catch { throw new HttpsError('failed-precondition', 'O saldo do pedido precisa de conferência pelo ateliê.'); }
    const collection = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`).collection('payments');
    if (detail) {
      const payment = await tx.get(collection.doc(String(data.paymentId)));
      if (!payment.exists) throw new HttpsError('not-found', 'Registro de pagamento não encontrado.');
      return { order: { id: orderId, atelierId, character: String(actor.order.character || 'Projeto de cosplay'), ...balance }, payments: [projectPayment(payment)], nextCursor: null };
    }
    let query = collection.orderBy(FieldPath.documentId()).limit(51);
    if (data.cursor) query = query.startAfter(data.cursor);
    const records = await tx.get(query);
    const page = records.docs.slice(0, 50);
    return { order: { id: orderId, atelierId, character: String(actor.order.character || 'Projeto de cosplay'), ...balance }, payments: page.map(projectPayment), nextCursor: records.size > 50 ? page.at(-1)!.id : null };
  });
}

export const listClientOrderPayments = onCall(call => readPayments(call, false));
export const getClientPayment = onCall(call => readPayments(call, true));
