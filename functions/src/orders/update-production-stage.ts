import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireOrderManager, requireVerifiedIdentity } from './access';
import { calculateWeightedProductionProgress, productionSemantic, statusAfterProductionCompletion } from './production-template';
import { productionFingerprint, productionId, productionOperationId, productionVersion, readProductionManager } from './production-configuration';
import { orderRemainingCents } from './change-policy';
import { captureProductionPhotoEvidence, type ProductionPhotoEvidence } from './production-evidence';

type Action = 'start' | 'progress' | 'complete' | 'block' | 'cancel_approval';

export const updateProductionStage = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = call.data as Record<string, unknown>;
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || Object.keys(data).some((key) => !['atelierId', 'orderId', 'stageId', 'action', 'progress', 'note', 'requestId', 'expectedVersion'].includes(key))) throw new HttpsError('invalid-argument', 'Há campos fora do contrato da produção.');
  const atelierId = productionId(data.atelierId, 'Ateliê');
  const orderId = productionId(data.orderId, 'Pedido');
  const stageId = productionId(data.stageId, 'Etapa');
  if (!['start', 'progress', 'complete', 'block', 'cancel_approval'].includes(String(data.action))) throw new HttpsError('invalid-argument', 'Ação de produção inválida.');
  const action = data.action as Action;
  const note = typeof data.note === 'string' ? data.note.trim() : '';
  if ((data.note !== undefined && typeof data.note !== 'string') || note.length > 600 || (['block', 'cancel_approval'].includes(action) && note.length < 4)) throw new HttpsError('invalid-argument', 'Descreva o motivo em até 600 caracteres.');
  const progress = data.progress;
  if (action === 'progress' && (typeof progress !== 'number' || !Number.isInteger(progress) || progress < 1 || progress > 99)) throw new HttpsError('invalid-argument', 'O progresso intermediário deve estar entre 1% e 99%.');
  if (data.expectedVersion !== undefined && (!Number.isSafeInteger(data.expectedVersion) || Number(data.expectedVersion) < 0)) throw new HttpsError('invalid-argument', 'A versão esperada da etapa é inválida.');
  const requestId = data.requestId === undefined ? null : productionId(data.requestId, 'Identificador da operação');
  await requireOrderManager(atelierId, call.auth!.uid, 'orders:manage');
  const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
  const stagesRef = orderRef.collection('productionStages');
  const stageRef = stagesRef.doc(stageId);
  const operationRef = requestId ? orderRef.collection('productionOperations').doc(productionOperationId(call.auth!.uid, requestId)) : null;
  const fingerprint = productionFingerprint({ action, stageId, note, progress: action === 'progress' ? progress : null, expectedVersion: data.expectedVersion ?? null });

  return adminDb.runTransaction(async (transaction) => {
    const [, orderSnapshot, stageSnapshots, operation] = await Promise.all([
      readProductionManager(transaction, atelierId, call.auth!.uid), transaction.get(orderRef),
      transaction.get(stagesRef.orderBy('order', 'asc')), operationRef ? transaction.get(operationRef) : Promise.resolve(null),
    ]);
    if (!orderSnapshot.exists) throw new HttpsError('not-found', 'O pedido não foi encontrado.');
    if (operation?.exists) {
      if (operation.get('fingerprint') !== fingerprint) throw new HttpsError('already-exists', 'Esta chave de operação já foi utilizada com outra ação.');
      return { ...operation.get('result'), replayed: true };
    }
    const order = orderSnapshot.data()!;
    const current = stageSnapshots.docs.find((stage) => stage.id === stageId);
    if (!current) throw new HttpsError('not-found', 'A etapa não pertence a este pedido.');
    const currentStage: Record<string, unknown> & { id: string } = { ...current.data(), id: current.id };
    const stages: Array<Record<string, unknown> & { id: string; status: string; order: number }> = stageSnapshots.docs.map((stage) => ({ ...stage.data(), id: stage.id, status: String(stage.get('status')), order: Number(stage.get('order')) }));
    let remainingCents: number;
    try { remainingCents = orderRemainingCents(order); }
    catch { throw new HttpsError('failed-precondition', 'O saldo financeiro do pedido precisa de revisão antes de alterar a produção.'); }
    const version = productionVersion(currentStage.version);
    if (data.expectedVersion !== undefined && data.expectedVersion !== version) throw new HttpsError('aborted', 'A etapa mudou. Atualize a tela antes de enviar outra ação.');
    if (!['confirmed', 'scheduled', 'modeling', 'in_production', 'fitting', 'adjustments', 'finishing', 'ready_to_ship', 'paused', 'waiting_final_payment'].includes(String(order.status))) throw new HttpsError('failed-precondition', 'A produção só pode ser atualizada depois da confirmação do pedido.');
    const previousIncomplete = stages.find((stage) => stage.order < Number(currentStage.order) && !['completed', 'approved'].includes(stage.status));
    if (previousIncomplete) throw new HttpsError('failed-precondition', `Conclua primeiro a etapa ${String(previousIncomplete.name)}.`);
    if (action === 'start') {
      if (!['pending', 'blocked'].includes(String(currentStage.status))) throw new HttpsError('failed-precondition', 'Esta etapa não pode ser iniciada neste estado.');
    } else if (action === 'cancel_approval') {
      if (currentStage.status !== 'waiting_approval' || typeof currentStage.pendingApprovalId !== 'string') throw new HttpsError('failed-precondition', 'A etapa não possui uma solicitação pendente para cancelar.');
    } else if (currentStage.status !== 'in_progress') throw new HttpsError('failed-precondition', 'A etapa precisa estar em andamento para esta ação.');
    let semantic: string;
    try { semantic = productionSemantic(currentStage); }
    catch { throw new HttpsError('failed-precondition', 'A fase operacional da etapa precisa de revisão.'); }
    if (stageId === 'stage-shipping') {
      if (stages.at(-1)?.id !== stageId) throw new HttpsError('failed-precondition', 'O envio precisa ser a última etapa da produção.');
      if (['start', 'complete'].includes(action) && remainingCents !== 0) throw new HttpsError('failed-precondition', 'O saldo final precisa estar confirmado antes de iniciar ou concluir o envio.');
    }
    let photoEvidence: ProductionPhotoEvidence[] = [];
    if (action === 'complete' && currentStage.requiresClientApproval === true) {
      const visiblePhotos = await transaction.get(orderRef.collection('photos').where('stageId', '==', stageId).where('visibleToClient', '==', true).where('uploadStatus', '==', 'ready'));
      if (visiblePhotos.empty) throw new HttpsError('failed-precondition', 'Envie ao menos uma foto visível ao cliente antes de solicitar aprovação.');
      photoEvidence = visiblePhotos.docs.map((photo) => captureProductionPhotoEvidence(atelierId, orderId, stageId, photo.id, photo.data()));
    }
    const canceledApproval = action === 'cancel_approval'
      ? await transaction.get(orderRef.collection('approvals').doc(productionId(currentStage.pendingApprovalId, 'Aprovação pendente')))
      : null;
    if (canceledApproval && (!canceledApproval.exists || canceledApproval.get('status') !== 'pending' || canceledApproval.get('stageId') !== stageId)) throw new HttpsError('failed-precondition', 'A aprovação já recebeu uma resposta ou não pertence à etapa.');
    const now = Timestamp.now();
    const priorStatus = String(currentStage.status);
    let nextStageStatus = priorStatus;
    let nextStageProgress = Number(currentStage.progress) || 0;
    let nextOrderStatus = String(order.status);
    let pendingApprovalId = typeof currentStage.pendingApprovalId === 'string' ? currentStage.pendingApprovalId : null;
    if (action === 'start') {
      nextStageStatus = 'in_progress';
      nextOrderStatus = semantic === 'shipping' ? 'ready_to_ship' : semantic;
    } else if (action === 'progress') nextStageProgress = progress as number;
    else if (action === 'complete') {
      nextStageProgress = 100;
      if (currentStage.requiresClientApproval === true) {
        nextStageStatus = 'waiting_approval';
        const approvalRef = orderRef.collection('approvals').doc();
        pendingApprovalId = approvalRef.id;
        transaction.create(approvalRef, {
          atelierId, orderId, stageId, stageName: currentStage.name, clientId: order.clientId ?? null,
          status: 'pending', requestedBy: call.auth!.uid, requestedAt: now, comment: note || null,
          progressBeforeApproval: Number(currentStage.progress) || 0,
          photoEvidence, evidencePolicyVersion: 1,
          stageVersion: version + 1, configurationVersion: productionVersion(order.productionConfigurationVersion),
          stageSnapshot: {
            id: stageId, name: currentStage.name, order: currentStage.order, progressWeight: currentStage.progressWeight,
            requiresClientApproval: true, semanticKey: semantic, assignedTo: currentStage.assignedTo ?? null,
            plannedStartDate: currentStage.plannedStartDate ?? null, deadline: currentStage.deadline ?? null,
          },
        });
        transaction.create(approvalRef.collection('events').doc(), { actorId: call.auth!.uid, action: 'requested', comment: note || null, createdAt: now });
        if (typeof order.clientUserId === 'string') transaction.create(adminDb.collection(`ateliers/${atelierId}/notifications`).doc(), {
          userId: order.clientUserId, type: 'approval_required', title: 'Aprovação de etapa necessária',
          message: `A etapa ${String(currentStage.name)} do projeto ${String(order.character)} aguarda sua aprovação.`, orderId, createdAt: now, read: false,
        });
      } else {
        nextStageStatus = 'completed';
        nextOrderStatus = statusAfterProductionCompletion(currentStage, stages, remainingCents / 100);
      }
    } else if (action === 'cancel_approval' && canceledApproval) {
      const earlierProgress = canceledApproval.get('progressBeforeApproval');
      nextStageStatus = 'in_progress';
      nextStageProgress = typeof earlierProgress === 'number' && Number.isInteger(earlierProgress) ? Math.max(0, Math.min(99, earlierProgress)) : 0;
      nextOrderStatus = semantic === 'shipping' ? (remainingCents === 0 ? 'ready_to_ship' : 'waiting_final_payment') : semantic;
      pendingApprovalId = null;
      transaction.update(canceledApproval.ref, { status: 'cancelled', cancelledBy: call.auth!.uid, cancellationReason: note, cancelledAt: now });
      transaction.create(canceledApproval.ref.collection('events').doc(), { actorId: call.auth!.uid, action: 'cancelled', comment: note, createdAt: now });
    } else {
      nextStageStatus = 'blocked';
      nextOrderStatus = 'paused';
    }
    const weightedProgress = calculateWeightedProductionProgress(stages.map((stage) => ({ progress: stage.id === stageId ? nextStageProgress : Number(stage.progress) || 0, progressWeight: Number(stage.progressWeight) })));
    transaction.update(stageRef, {
      status: nextStageStatus, progress: nextStageProgress, version: version + 1,
      ...(note ? { notes: note } : {}),
      ...(action === 'start' && !currentStage.startedAt ? { startedAt: now } : {}),
      ...(action === 'start' && priorStatus === 'blocked' ? { blockResolvedAt: now, blockedReason: null } : {}),
      ...(action === 'block' ? { blockedReason: note, blockedAt: now, blockedBy: call.auth!.uid } : {}),
      ...(action === 'complete' && nextStageStatus === 'completed' ? { completedAt: now } : {}),
      ...(action === 'complete' && nextStageStatus === 'waiting_approval' ? { pendingApprovalId } : {}), updatedAt: now,
      ...(action === 'cancel_approval' ? { pendingApprovalId: null } : {}),
    });
    transaction.update(orderRef, { status: nextOrderStatus, progress: weightedProgress, updatedAt: now });
    transaction.create(stageRef.collection('updates').doc(), { actorId: call.auth!.uid, action, version: version + 1, before: { status: priorStatus, progress: Number(currentStage.progress) || 0 }, after: { status: nextStageStatus, progress: nextStageProgress }, note: note || null, requestId, createdAt: now });
    transaction.create(orderRef.collection('statusHistory').doc(), { status: nextOrderStatus, actorId: call.auth!.uid, source: `production_stage_${action}`, stageId, stageName: currentStage.name, progress: nextStageProgress, createdAt: now });
    transaction.create(adminDb.collection('auditLogs').doc(), { actorId: call.auth!.uid, atelierId, action: `production.stage_${action}`, entity: 'order', entityId: orderId, before: { stageId, status: priorStatus, progress: currentStage.progress, orderStatus: order.status }, after: { stageId, status: nextStageStatus, progress: nextStageProgress, orderStatus: nextOrderStatus }, timestamp: FieldValue.serverTimestamp() });
    const result = { orderId, stageId, status: nextOrderStatus, progress: weightedProgress, version: version + 1, replayed: false };
    if (operationRef) transaction.create(operationRef, { action, actorId: call.auth!.uid, requestId, fingerprint, result, createdAt: now });
    return result;
  });
});
