import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireVerifiedIdentity } from './access';
import { requireTenantWorkspaceIdentity } from '../commercial/access';
import { productionFingerprint, productionId, productionOperationId, productionVersion, readProductionManager } from './production-configuration';
import { financialOrder } from '../finance/policy';
import { writeInternalNotification } from '../notifications/create-notification';

/** Manual delivery evidence; no carrier, financial transaction or irreversible deletion. */
export const finalizeOrder = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const identity = await requireTenantWorkspaceIdentity(call.auth!.uid, call.auth!.token);
  const input = call.data as Record<string, unknown>;
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !['orderId', 'action', 'note', 'method', 'requestId', 'expectedVersion'].includes(key))) throw new HttpsError('invalid-argument', 'Há campos fora do contrato de entrega.');
  const orderId = productionId(input.orderId, 'Pedido'); const requestId = productionId(input.requestId, 'Operação');
  if (!['deliver', 'complete'].includes(String(input.action)) || typeof input.note !== 'string' || input.note.trim().length < 4 || input.note.trim().length > 600
    || !Number.isSafeInteger(input.expectedVersion) || Number(input.expectedVersion) < 0 || Number(input.expectedVersion) >= Number.MAX_SAFE_INTEGER
    || (input.action === 'deliver' ? !['pickup', 'shipping'].includes(String(input.method)) : input.method !== undefined)) throw new HttpsError('invalid-argument', 'Revise a ação, a modalidade, o registro e a versão da entrega.');
  const action = input.action as 'deliver' | 'complete'; const note = input.note.trim(); const method = action === 'deliver' ? input.method : null;
  const orderRef = adminDb.doc(`ateliers/${identity.atelierId}/orders/${orderId}`);
  const operationRef = orderRef.collection('lifecycleOperations').doc(productionOperationId(call.auth!.uid, requestId));
  const fingerprint = productionFingerprint({ action, note, method, expectedVersion: input.expectedVersion });
  return adminDb.runTransaction(async (tx) => {
    await readProductionManager(tx, identity.atelierId, call.auth!.uid);
    const [snapshot, operation] = await Promise.all([tx.get(orderRef), tx.get(operationRef)]);
    if (!snapshot.exists) throw new HttpsError('not-found', 'O pedido não foi encontrado neste ateliê.');
    if (operation.exists) {
      if (operation.get('fingerprint') !== fingerprint) throw new HttpsError('already-exists', 'A chave de operação já foi usada com outros dados.');
      return { ...operation.get('result'), alreadyApplied: true };
    }
    const order = snapshot.data()!; const version = productionVersion(order.lifecycleVersion);
    if (version !== input.expectedVersion) throw new HttpsError('aborted', 'A entrega mudou. Atualize o pedido antes de confirmar.');
    if (order.status !== (action === 'deliver' ? 'shipped' : 'delivered')) throw new HttpsError('failed-precondition', action === 'deliver' ? 'Conclua a expedição ou retirada nas etapas antes de registrar a entrega.' : 'Registre a entrega antes de encerrar o pedido.');
    let amounts;
    try { amounts = financialOrder(order); } catch { throw new HttpsError('failed-precondition', 'Concilie os valores do acordo e os recebimentos antes de registrar a entrega.'); }
    if (amounts.remainingCents !== 0) throw new HttpsError('failed-precondition', 'O pedido ainda tem saldo a receber. Confira o financeiro.');
    if (order.planningNeedsReview === true) throw new HttpsError('failed-precondition', 'Revise o planejamento do acordo antes de encerrar.');
    const root = adminDb.doc(`ateliers/${identity.atelierId}`);
    const [stages, approvals, changes, requirements, reservations, slots] = await Promise.all([
      tx.get(orderRef.collection('productionStages').limit(101)),
      tx.get(orderRef.collection('approvals').where('status', '==', 'pending').limit(1)),
      tx.get(orderRef.collection('changeRequests').where('status', 'in', ['pending', 'approved']).limit(1)),
      tx.get(orderRef.collection('materialRequirements').limit(501)),
      tx.get(root.collection('inventoryReservations').where('orderId', '==', orderId).limit(501)),
      tx.get(root.collection('productionSlots').where('orderId', '==', orderId).limit(501)),
    ]);
    if (stages.size > 100 || [requirements, reservations, slots].some((list) => list.size > 500)) throw new HttpsError('resource-exhausted', 'O volume exige conciliação paginada antes do encerramento.');
    if (!stages.size || stages.docs.some((stage) => !['completed', 'approved'].includes(stage.get('status')) || stage.get('progress') !== 100) || order.progress !== 100 || !approvals.empty || !changes.empty) throw new HttpsError('failed-precondition', 'Conclua etapas, aprovações e revisões antes de registrar a entrega.');
    if (requirements.docs.some((item) => !Number.isSafeInteger(item.get('reservedMilli')) || item.get('reservedMilli') !== 0)
      || reservations.docs.some((item) => !Number.isSafeInteger(item.get('remainingMilli')) || item.get('remainingMilli') !== 0)) throw new HttpsError('failed-precondition', 'Consuma ou libere as reservas de materiais antes da entrega. O histórico será preservado.');
    const now = Timestamp.now();
    if (slots.docs.some((slot) => slot.get('status') === 'scheduled' && (!(slot.get('endAt') instanceof Timestamp) || slot.get('endAt').toMillis() > now.toMillis()))) throw new HttpsError('failed-precondition', 'Cancele as horas futuras ainda alocadas a este pedido antes da entrega.');
    const status = action === 'deliver' ? 'delivered' : 'completed'; const nextVersion = version + 1;
    tx.update(orderRef, { status, lifecycleVersion: nextVersion, updatedAt: now, ...(action === 'deliver' ? { deliveredAt: now, deliveryMethod: method } : { completedAt: now }) });
    tx.create(orderRef.collection('statusHistory').doc(), { status, actorId: call.auth!.uid, source: `manual_${action}`, note, method, createdAt: now });
    tx.create(adminDb.collection('auditLogs').doc(), { actorId: call.auth!.uid, atelierId: identity.atelierId, action: `order.${status}`, entity: 'order', entityId: orderId,
      before: { status: order.status, lifecycleVersion: version }, after: { status, lifecycleVersion: nextVersion, method }, timestamp: now });
    const result = { orderId, status, version: nextVersion, alreadyApplied: false };
    tx.create(operationRef, { fingerprint, result, createdAt: now });
    if (typeof order.clientUserId === 'string' && order.clientUserId.length > 0 && order.clientUserId.length <= 128 && !order.clientUserId.includes('/')) writeInternalNotification(tx, {
      atelierId: identity.atelierId, userId: order.clientUserId, eventId: `${status}-${nextVersion}`, type: 'order_updated', orderId,
      title: action === 'deliver' ? 'Entrega registrada' : 'Pedido concluído', message: action === 'deliver' ? 'O ateliê registrou a entrega do seu pedido. Consulte o histórico.' : 'O ateliê concluiu o pedido. Seu histórico permanece disponível.',
    });
    return result;
  });
});
