import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireOrderManager, requireVerifiedIdentity } from './access';
import { defaultProductionStages } from './production-template';

const paymentMethods = ['pix', 'bank_transfer', 'cash', 'other'] as const;

export const confirmOrderDeposit = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = call.data as { atelierId?: unknown; orderId?: unknown; method?: unknown; reference?: unknown };
  if (typeof data.atelierId !== 'string' || !data.atelierId || typeof data.orderId !== 'string' || !data.orderId) {
    throw new HttpsError('invalid-argument', 'Ateliê e pedido são obrigatórios.');
  }
  if (typeof data.method !== 'string' || !paymentMethods.includes(data.method as typeof paymentMethods[number])) {
    throw new HttpsError('invalid-argument', 'Informe como a entrada foi recebida.');
  }
  const reference = typeof data.reference === 'string' ? data.reference.trim() : '';
  if (reference.length > 120) throw new HttpsError('invalid-argument', 'A referência pode ter até 120 caracteres.');
  await requireOrderManager(data.atelierId, call.auth!.uid, 'payments:write');

  const atelier = adminDb.doc(`ateliers/${data.atelierId}`);
  const orderRef = atelier.collection('orders').doc(data.orderId);
  const paymentRef = orderRef.collection('payments').doc('deposit');
  const stageRefs = defaultProductionStages.map((stage) => orderRef.collection('productionStages').doc(stage.id));
  const historyRef = orderRef.collection('statusHistory').doc();
  const auditRef = adminDb.collection('auditLogs').doc();
  let alreadyConfirmed = false;

  await adminDb.runTransaction(async (transaction) => {
    const [orderSnapshot, paymentSnapshot, ...stageSnapshots] = await Promise.all([
      transaction.get(orderRef), transaction.get(paymentRef), ...stageRefs.map((stageRef) => transaction.get(stageRef)),
    ]);
    if (!orderSnapshot.exists) throw new HttpsError('not-found', 'O pedido não foi encontrado neste ateliê.');
    const order = orderSnapshot.data()!;
    if (order.status === 'confirmed' && paymentSnapshot.data()?.status === 'paid') { alreadyConfirmed = true; return; }
    if (order.status !== 'waiting_deposit' || !paymentSnapshot.exists || paymentSnapshot.data()?.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'O pedido não está aguardando a confirmação da entrada.');
    }
    const amount = paymentSnapshot.data()?.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount !== order.approvedQuoteSnapshot?.depositAmount) {
      throw new HttpsError('failed-precondition', 'O valor da entrada não corresponde à proposta aprovada.');
    }

    const now = Timestamp.now();
    transaction.update(paymentRef, {
      status: 'paid', method: data.method, reference: reference || null,
      confirmedBy: call.auth!.uid, paidAt: now, updatedAt: now,
    });
    transaction.update(orderRef, {
      status: 'confirmed', amountPaid: amount,
      amountRemaining: Math.max(0, Number(order.approvedQuoteSnapshot.total) - amount),
      updatedAt: now,
    });
    stageSnapshots.forEach((snapshot, index) => {
      if (!snapshot.exists) transaction.create(stageRefs[index], {
        ...defaultProductionStages[index], atelierId: data.atelierId, orderId: data.orderId,
        status: 'pending', progress: 0, createdAt: now, updatedAt: now,
      });
    });
    transaction.create(historyRef, { status: 'confirmed', actorId: call.auth!.uid, source: 'manual_deposit_confirmation', createdAt: now });
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: data.atelierId, action: 'payment.deposit_confirmed_manually',
      entity: 'order', entityId: data.orderId,
      before: { orderStatus: order.status, paymentStatus: paymentSnapshot.data()?.status, amount },
      after: { orderStatus: 'confirmed', paymentStatus: 'paid', method: data.method, reference: reference || null },
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  return { orderId: data.orderId, status: 'confirmed' as const, alreadyConfirmed };
});
