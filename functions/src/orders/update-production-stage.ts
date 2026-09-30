import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireOrderManager, requireVerifiedIdentity } from './access';
import { calculateWeightedProductionProgress, orderStatusForStage } from './production-template';

type Action = 'start' | 'progress' | 'complete' | 'block';

export const updateProductionStage = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = call.data as { atelierId?: unknown; orderId?: unknown; stageId?: unknown; action?: unknown; progress?: unknown; note?: unknown };
  if (typeof data.atelierId !== 'string' || typeof data.orderId !== 'string' || typeof data.stageId !== 'string') {
    throw new HttpsError('invalid-argument', 'Ateliê, pedido e etapa são obrigatórios.');
  }
  if (!['start', 'progress', 'complete', 'block'].includes(String(data.action))) {
    throw new HttpsError('invalid-argument', 'Ação de produção inválida.');
  }
  const action = data.action as Action;
  const note = typeof data.note === 'string' ? data.note.trim() : '';
  if (note.length > 600 || (action === 'block' && note.length < 4)) {
    throw new HttpsError('invalid-argument', 'Descreva o bloqueio em até 600 caracteres.');
  }
  const progress = data.progress === undefined ? undefined : Number(data.progress);
  if (action === 'progress' && (!Number.isInteger(progress) || progress! < 1 || progress! > 99)) {
    throw new HttpsError('invalid-argument', 'O progresso intermediário deve estar entre 1% e 99%.');
  }
  const atelierId = data.atelierId;
  const orderId = data.orderId;
  const stageId = data.stageId;
  await requireOrderManager(atelierId, call.auth!.uid, 'orders:manage');

  const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
  const stagesRef = orderRef.collection('productionStages');
  const stageRef = stagesRef.doc(stageId);
  const updateRef = stageRef.collection('updates').doc();
  const orderHistoryRef = orderRef.collection('statusHistory').doc();
  const auditRef = adminDb.collection('auditLogs').doc();
  let resultingStatus = '';
  let resultingProgress = 0;

  await adminDb.runTransaction(async (transaction) => {
    const [orderSnapshot, stageSnapshots] = await Promise.all([transaction.get(orderRef), transaction.get(stagesRef.orderBy('order', 'asc'))]);
    if (!orderSnapshot.exists) throw new HttpsError('not-found', 'O pedido não foi encontrado.');
    const order = orderSnapshot.data()!;
    const current = stageSnapshots.docs.find((stage) => stage.id === stageId);
    if (!current) throw new HttpsError('not-found', 'A etapa não pertence a este pedido.');
    const currentStage = current.data();
    const stages: Array<{ id: string; order: number; status: string; name: string; progress: number; progressWeight: number }> = stageSnapshots.docs.map((stage) => ({ id: stage.id, ...stage.data() })) as Array<{ id: string; order: number; status: string; name: string; progress: number; progressWeight: number }>;
    const activeOrderStatuses = ['confirmed', 'scheduled', 'modeling', 'in_production', 'fitting', 'adjustments', 'finishing', 'ready_to_ship', 'paused'];
    if (!activeOrderStatuses.includes(String(order.status))) throw new HttpsError('failed-precondition', 'A produção só pode ser atualizada depois da confirmação do pedido.');

    if (action === 'start') {
      const previousIncomplete = stages.find((stage) => stage.order < Number(currentStage.order) && !['completed', 'approved'].includes(String(stage.status)));
      if (previousIncomplete) throw new HttpsError('failed-precondition', `Conclua primeiro a etapa ${String(previousIncomplete.name)}.`);
      if (!['pending', 'blocked'].includes(String(currentStage.status))) throw new HttpsError('failed-precondition', 'Esta etapa não pode ser iniciada neste estado.');
    } else if (action === 'progress' || action === 'complete' || action === 'block') {
      if (currentStage.status !== 'in_progress') throw new HttpsError('failed-precondition', 'A etapa precisa estar em andamento para esta ação.');
    }
    if (action === 'complete' && currentStage.requiresClientApproval === true) {
      const visiblePhotos = await transaction.get(orderRef.collection('photos').where('stageId', '==', stageId).where('visibleToClient', '==', true).where('uploadStatus', '==', 'ready').limit(1));
      if (visiblePhotos.empty) throw new HttpsError('failed-precondition', 'Envie ao menos uma foto visível ao cliente antes de solicitar aprovação.');
    }
    if (action === 'start' && currentStage.id === 'stage-shipping' && Number(order.amountRemaining) > 0) {
      throw new HttpsError('failed-precondition', 'O saldo final precisa estar confirmado antes de iniciar o envio.');
    }

    const now = Timestamp.now();
    const priorStatus = String(currentStage.status);
    let nextStageStatus = priorStatus;
    let nextStageProgress = Number(currentStage.progress) || 0;
    let nextOrderStatus = String(order.status);
    let pendingApprovalId = typeof currentStage.pendingApprovalId === 'string' ? currentStage.pendingApprovalId : null;
    if (action === 'start') {
      nextStageStatus = 'in_progress';
      nextOrderStatus = orderStatusForStage(stageId, 'start');
    } else if (action === 'progress') {
      nextStageProgress = progress!;
    } else if (action === 'complete') {
      if (currentStage.requiresClientApproval === true) {
        nextStageStatus = 'waiting_approval';
        nextStageProgress = 100;
        const approvalRef = orderRef.collection('approvals').doc();
        const eventRef = approvalRef.collection('events').doc();
        pendingApprovalId = approvalRef.id;
        transaction.create(approvalRef, {
          atelierId, orderId, stageId,
          stageName: currentStage.name, clientId: order.clientId ?? null,
          status: 'pending', requestedBy: call.auth!.uid, requestedAt: now, comment: note || null,
        });
        transaction.create(eventRef, { actorId: call.auth!.uid, action: 'requested', comment: note || null, createdAt: now });
        if (typeof order.clientUserId === 'string') {
          transaction.create(adminDb.collection(`ateliers/${atelierId}/notifications`).doc(), {
            userId: order.clientUserId, type: 'approval_required', title: 'Aprovação de etapa necessária',
            message: `A etapa ${String(currentStage.name)} do projeto ${String(order.character)} aguarda sua aprovação.`,
            orderId, createdAt: now, read: false,
          });
        }
      } else {
        nextStageStatus = 'completed';
        nextStageProgress = 100;
        nextOrderStatus = stageId === 'stage-finishing' && Number(order.amountRemaining) === 0
          ? 'ready_to_ship'
          : orderStatusForStage(stageId, 'complete');
      }
    } else if (action === 'block') {
      nextStageStatus = 'blocked';
      nextOrderStatus = 'paused';
    }

    const progressInputs = stages.map((stage) => ({
      progress: stage.id === stageId ? nextStageProgress : Number(stage.progress) || 0,
      progressWeight: Number(stage.progressWeight),
    }));
    resultingProgress = calculateWeightedProductionProgress(progressInputs);
    resultingStatus = nextOrderStatus;
    transaction.update(stageRef, {
      status: nextStageStatus, progress: nextStageProgress,
      ...(note ? { notes: note } : {}),
      ...(action === 'start' && !currentStage.startedAt ? { startedAt: now } : {}),
      ...(action === 'complete' && nextStageStatus === 'completed' ? { completedAt: now } : {}),
      ...(action === 'complete' && nextStageStatus === 'waiting_approval' ? { pendingApprovalId } : {}),
      updatedAt: now,
    });
    transaction.update(orderRef, { status: nextOrderStatus, progress: resultingProgress, updatedAt: now });
    transaction.create(updateRef, {
      actorId: call.auth!.uid, action, before: { status: priorStatus, progress: Number(currentStage.progress) || 0 },
      after: { status: nextStageStatus, progress: nextStageProgress }, note: note || null, createdAt: now,
    });
    if (nextOrderStatus !== order.status) {
      transaction.create(orderHistoryRef, { status: nextOrderStatus, actorId: call.auth!.uid, source: `production_stage_${action}`, createdAt: now });
    }
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId, action: `production.stage_${action}`,
      entity: 'order', entityId: orderId,
      before: { stageId, status: priorStatus, progress: currentStage.progress, orderStatus: order.status },
      after: { stageId, status: nextStageStatus, progress: nextStageProgress, orderStatus: nextOrderStatus },
      timestamp: FieldValue.serverTimestamp(),
    });
  });
  return { orderId, stageId, status: resultingStatus, progress: resultingProgress };
});
