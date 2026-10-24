import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireVerifiedIdentity } from './access';
import { calculateWeightedProductionProgress, statusAfterProductionCompletion } from './production-template';
import { productionId, productionVersion } from './production-configuration';
import { orderRemainingCents } from './change-policy';
import { captureProductionPhotoEvidence, photoExistedBeforeProductionApproval, type ProductionPhotoEvidence } from './production-evidence';
import { orderClientUid } from './client-ownership';

export const respondToProductionApproval = onCall(async (call) => {
  const identity = requireVerifiedIdentity(call.auth);
  const data = call.data as Record<string, unknown>;
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || Object.keys(data).some((key) => !['atelierId', 'orderId', 'approvalId', 'decision', 'comment'].includes(key))) throw new HttpsError('invalid-argument', 'Há campos fora do contrato da aprovação.');
  const atelierId = productionId(data.atelierId, 'Ateliê');
  const orderId = productionId(data.orderId, 'Pedido');
  const approvalId = productionId(data.approvalId, 'Aprovação');
  if (data.decision !== 'approved' && data.decision !== 'changes_requested') throw new HttpsError('invalid-argument', 'Resposta de aprovação inválida.');
  const comment = typeof data.comment === 'string' ? data.comment.trim() : '';
  if ((data.comment !== undefined && typeof data.comment !== 'string') || comment.length > 1000 || (data.decision === 'changes_requested' && comment.length < 5)) throw new HttpsError('invalid-argument', 'Descreva o ajuste em até 1.000 caracteres.');
  const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
  const approvalRef = orderRef.collection('approvals').doc(approvalId);

  return adminDb.runTransaction(async (transaction) => {
    const [orderSnapshot, approvalSnapshot, atelier, user] = await Promise.all([
      transaction.get(orderRef), transaction.get(approvalRef), transaction.get(adminDb.doc(`ateliers/${atelierId}`)),
      transaction.get(adminDb.doc(`users/${call.auth!.uid}`)),
    ]);
    if (atelier.get('active') !== true || user.get('active') !== true || user.get('accountType') !== 'client') throw new HttpsError('permission-denied', 'O perfil do cliente e o ateliê precisam estar ativos para responder.');
    if (!orderSnapshot.exists || !approvalSnapshot.exists) throw new HttpsError('not-found', 'A etapa aguardando sua aprovação não foi encontrada.');
    const order = orderSnapshot.data()!;
    const approval = approvalSnapshot.data()!;
    const email = typeof identity.email === 'string' ? identity.email.trim().toLowerCase() : '';
    if (!email || await orderClientUid(transaction, atelierId, order) !== call.auth!.uid) throw new HttpsError('permission-denied', 'O pedido precisa estar vinculado à sua conta para registrar a aprovação.');
    if (approval.status !== 'pending') {
      if (approval.status === data.decision && approval.respondedBy === call.auth!.uid && (approval.responseComment ?? '') === comment) return {
        orderId, approvalId, status: data.decision, progress: approval.responseProgress ?? order.progress, replayed: true,
      };
      throw new HttpsError('failed-precondition', 'Esta aprovação já recebeu uma resposta.');
    }
    if (!['confirmed', 'scheduled', 'modeling', 'in_production', 'fitting', 'adjustments', 'finishing', 'paused', 'ready_to_ship', 'waiting_final_payment'].includes(String(order.status))) throw new HttpsError('failed-precondition', 'Este pedido não está ativo para uma aprovação de produção.');
    const stageId = productionId(approval.stageId, 'Etapa da aprovação');
    const stageRef = orderRef.collection('productionStages').doc(stageId);
    const [stageSnapshot, allStages] = await Promise.all([transaction.get(stageRef), transaction.get(orderRef.collection('productionStages').orderBy('order', 'asc'))]);
    const stage = stageSnapshot.data();
    if (!stage || stage.status !== 'waiting_approval' || stage.pendingApprovalId !== approvalId
      || (approval.stageVersion !== undefined && approval.stageVersion !== productionVersion(stage.version))) throw new HttpsError('failed-precondition', 'A aprovação não corresponde à versão atual da etapa.');
    if (approval.stageSnapshot) {
      const snapshot = approval.stageSnapshot;
      if (snapshot.name !== stage.name || snapshot.order !== stage.order || snapshot.progressWeight !== stage.progressWeight
        || snapshot.requiresClientApproval !== stage.requiresClientApproval || (snapshot.assignedTo ?? null) !== (stage.assignedTo ?? null)
        || (snapshot.plannedStartDate ?? null) !== (stage.plannedStartDate ?? null) || (snapshot.deadline ?? null) !== (stage.deadline ?? null)) throw new HttpsError('failed-precondition', 'A configuração da etapa mudou depois de ser enviada para aprovação.');
    }
    let photoEvidence: ProductionPhotoEvidence[];
    let capturedLegacyEvidence = false;
    if (approval.photoEvidence !== undefined) {
      if (!Array.isArray(approval.photoEvidence) || approval.photoEvidence.length === 0) throw new HttpsError('failed-precondition', 'A aprovação não contém evidências válidas.');
      const captured = approval.photoEvidence as Array<Record<string, unknown>>;
      const photos = await Promise.all(captured.map((photo) => transaction.get(orderRef.collection('photos').doc(productionId(photo.photoId, 'Foto de evidência')))));
      photoEvidence = photos.map((photo, index) => {
        if (!photo.exists) throw new HttpsError('failed-precondition', 'Uma foto da aprovação não está mais disponível.');
        const validated = captureProductionPhotoEvidence(atelierId, orderId, stageId, photo.id, photo.data()!);
        if (validated.storagePath !== captured[index].storagePath || validated.storageGeneration !== captured[index].storageGeneration) throw new HttpsError('failed-precondition', 'Uma evidência não corresponde ao snapshot da aprovação.');
        return validated;
      });
    } else {
      const legacyPhotos = await transaction.get(orderRef.collection('photos').where('stageId', '==', stageId).where('visibleToClient', '==', true).where('uploadStatus', '==', 'ready'));
      photoEvidence = legacyPhotos.docs.filter((photo) => photoExistedBeforeProductionApproval(photo.data(), approval.requestedAt))
        .map((photo) => captureProductionPhotoEvidence(atelierId, orderId, stageId, photo.id, photo.data()));
      if (!photoEvidence.length) throw new HttpsError('failed-precondition', 'A aprovação antiga não possui fotos verificáveis anteriores à solicitação. A equipe precisa emitir uma nova solicitação de revisão.');
      capturedLegacyEvidence = true;
    }
    const earlierIncomplete = allStages.docs.some((item) => Number(item.get('order')) < Number(stage.order) && !['completed', 'approved'].includes(String(item.get('status'))));
    if (earlierIncomplete) throw new HttpsError('failed-precondition', 'Uma etapa anterior ainda está pendente.');
    let remainingCents: number;
    try { remainingCents = orderRemainingCents(order); }
    catch { throw new HttpsError('failed-precondition', 'O saldo financeiro do pedido precisa de revisão antes de responder à aprovação.'); }
    if (stageId === 'stage-shipping' && (allStages.docs.at(-1)?.id !== stageId || (data.decision === 'approved' && remainingCents !== 0))) throw new HttpsError('failed-precondition', 'O envio exige todas as etapas anteriores e o saldo final confirmado.');
    const now = Timestamp.now();
    const accepted = data.decision === 'approved';
    const nextStageStatus = accepted ? 'completed' : 'in_progress';
    const earlierProgress = typeof approval.progressBeforeApproval === 'number' && Number.isInteger(approval.progressBeforeApproval)
      ? Math.max(0, Math.min(99, approval.progressBeforeApproval)) : 0;
    const nextStageProgress = accepted ? 100 : earlierProgress;
    const stages: Array<Record<string, unknown> & { id: string; status: string }> = allStages.docs.map((item) => ({ ...item.data(), id: item.id, status: String(item.get('status')) }));
    const finalProgress = calculateWeightedProductionProgress(stages.map((item) => ({ progress: item.id === stageId ? nextStageProgress : Number(item.progress) || 0, progressWeight: Number(item.progressWeight) })));
    const finalStatus = accepted ? statusAfterProductionCompletion({ ...stage, id: stageId }, stages, remainingCents / 100) : 'adjustments';
    transaction.update(approvalRef, { status: data.decision, respondedBy: call.auth!.uid, responseComment: comment || null, respondedAt: now, responseProgress: finalProgress, responseOrderStatus: finalStatus,
      ...(capturedLegacyEvidence ? { photoEvidence, evidencePolicyVersion: 1, legacyEvidenceCapturedAt: now } : {}),
    });
    transaction.create(approvalRef.collection('events').doc(), { actorId: call.auth!.uid, action: data.decision, comment: comment || null, createdAt: now });
    transaction.update(stageRef, { status: nextStageStatus, progress: nextStageProgress, pendingApprovalId: null, version: productionVersion(stage.version) + 1, ...(accepted ? { completedAt: now } : { notes: comment }), updatedAt: now });
    transaction.create(stageRef.collection('updates').doc(), { actorId: call.auth!.uid, action: accepted ? 'client_approved' : 'client_requested_adjustment', approvalId, before: { status: stage.status, progress: stage.progress }, after: { status: nextStageStatus, progress: nextStageProgress }, note: comment || null, createdAt: now });
    transaction.update(orderRef, { status: finalStatus, progress: finalProgress, updatedAt: now });
    transaction.create(orderRef.collection('statusHistory').doc(), { status: finalStatus, actorId: call.auth!.uid, source: accepted ? 'client_approved_production_stage' : 'client_requested_production_adjustment', stageId, approvalId, createdAt: now });
    transaction.create(adminDb.collection('auditLogs').doc(), { actorId: call.auth!.uid, atelierId, action: accepted ? 'production.client_approved_stage' : 'production.client_requested_adjustment', entity: 'order', entityId: orderId, before: { approvalStatus: approval.status, stageStatus: stage.status, orderStatus: order.status }, after: { approvalStatus: data.decision, stageStatus: nextStageStatus, orderStatus: finalStatus, comment: comment || null }, timestamp: FieldValue.serverTimestamp() });
    return { orderId, approvalId, status: data.decision, progress: finalProgress, replayed: false };
  });
});
