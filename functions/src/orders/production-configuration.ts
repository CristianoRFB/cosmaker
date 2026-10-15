import { createHash } from 'node:crypto';
import { FieldValue, Timestamp, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireOrderManager, requireVerifiedIdentity } from './access';
import {
  calculateWeightedProductionProgress, canonicalProductionSemantics, productionSemantic, validateProductionConfiguration,
  type ProductionConfigurationStage,
} from './production-template';
import { orderRemainingCents } from './change-policy';

export function productionId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new HttpsError('invalid-argument', `${label} inválido.`);
  return value;
}

export function productionVersion(value: unknown): number {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) >= Number.MAX_SAFE_INTEGER) throw new HttpsError('failed-precondition', 'A versão da produção precisa de revisão.');
  return Number(value);
}

export function productionUpdatedAt(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Timestamp) return `${value.seconds}:${value.nanoseconds}`;
  throw new HttpsError('failed-precondition', 'A data de atualização da etapa precisa de revisão.');
}

export async function readProductionManager(transaction: Transaction, atelierId: string, uid: string) {
  const [atelier, member, user] = await Promise.all([
    transaction.get(adminDb.doc(`ateliers/${atelierId}`)),
    transaction.get(adminDb.doc(`ateliers/${atelierId}/members/${uid}`)),
    transaction.get(adminDb.doc(`users/${uid}`)),
  ]);
  const membership = member.data();
  const profile = user.data();
  if (atelier.data()?.active !== true || membership?.active !== true || profile?.active !== true
    || profile.atelierId !== atelierId || profile.accountType !== 'atelier_member'
    || !(membership.role === 'owner' || membership.role === 'admin'
      || (Array.isArray(membership.permissions) && membership.permissions.includes('orders:manage')))) {
    throw new HttpsError('permission-denied', 'Sua conta não tem acesso ativo para gerenciar a produção deste ateliê.');
  }
  return { atelier: atelier.data()!, member: membership, profile };
}

export function productionOperationId(uid: string, requestId: string) {
  return createHash('sha256').update(`${uid}:${requestId}`).digest('hex');
}

export function productionFingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function plainData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpsError('invalid-argument', 'A configuração da produção é inválida.');
  return value as Record<string, unknown>;
}

function parseStages(value: unknown): ProductionConfigurationStage[] {
  if (!Array.isArray(value) || value.length > 100) throw new HttpsError('invalid-argument', 'Informe as etapas da produção. O limite técnico da transação é de 100 etapas.');
  return value.map((raw) => {
    const stage = plainData(raw);
    if (Object.keys(stage).some((key) => !['id', 'name', 'progressWeight', 'requiresClientApproval', 'semanticKey', 'assignedTo', 'plannedStartDate', 'deadline', 'expectedUpdatedAt'].includes(key))) throw new HttpsError('invalid-argument', 'Há campos de etapa fora do contrato.');
    const id = productionId(stage.id, 'Identificador de etapa');
    if (typeof stage.name !== 'string' || stage.name.trim().length < 2 || stage.name.trim().length > 100
      || typeof stage.requiresClientApproval !== 'boolean'
      || !['confirmed', 'modeling', 'in_production', 'fitting', 'finishing', 'shipping'].includes(String(stage.semanticKey))
      || !(stage.expectedUpdatedAt === null || (typeof stage.expectedUpdatedAt === 'string' && /^-?\d+:\d{1,9}$/.test(stage.expectedUpdatedAt)))) {
      throw new HttpsError('invalid-argument', 'Nome, fase, aprovação ou versão da etapa inválidos.');
    }
    for (const field of ['plannedStartDate', 'deadline']) {
      if (stage[field] !== null && typeof stage[field] !== 'string') throw new HttpsError('invalid-argument', 'Informe datas ou deixe o campo vazio.');
    }
    return {
      id, name: stage.name.trim(), progressWeight: stage.progressWeight as number,
      requiresClientApproval: stage.requiresClientApproval, semanticKey: stage.semanticKey as ProductionConfigurationStage['semanticKey'],
      assignedTo: stage.assignedTo === null ? null : productionId(stage.assignedTo, 'Responsável'),
      plannedStartDate: stage.plannedStartDate as string | null, deadline: stage.deadline as string | null,
      expectedUpdatedAt: stage.expectedUpdatedAt as string | null,
    };
  });
}

export const getOrderProductionConfiguration = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const input = plainData(call.data);
  if (Object.keys(input).some((key) => !['atelierId', 'orderId'].includes(key))) throw new HttpsError('invalid-argument', 'Há campos fora do contrato.');
  const atelierId = productionId(input.atelierId, 'Ateliê');
  const orderId = productionId(input.orderId, 'Pedido');
  await requireOrderManager(atelierId, call.auth!.uid, 'orders:manage');
  const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
  return adminDb.runTransaction(async (transaction) => {
    const [, order, stages, members] = await Promise.all([
      readProductionManager(transaction, atelierId, call.auth!.uid), transaction.get(orderRef),
      transaction.get(orderRef.collection('productionStages').orderBy('order', 'asc')),
      transaction.get(adminDb.collection(`ateliers/${atelierId}/members`).where('active', '==', true)),
    ]);
    if (!order.exists) throw new HttpsError('not-found', 'Pedido não encontrado.');
    const profiles = await Promise.all(members.docs.map((member) => transaction.get(adminDb.doc(`users/${member.id}`))));
    return {
      version: productionVersion(order.get('productionConfigurationVersion')),
      stages: stages.docs.map((snapshot) => ({
        id: snapshot.id, name: String(snapshot.get('name')), progressWeight: Number(snapshot.get('progressWeight')),
        requiresClientApproval: snapshot.get('requiresClientApproval') === true,
        semanticKey: canonicalProductionSemantics[snapshot.id] ?? snapshot.get('semanticKey'),
        assignedTo: snapshot.get('assignedTo') ?? null, plannedStartDate: snapshot.get('plannedStartDate') ?? null,
        deadline: snapshot.get('deadline') ?? null, expectedUpdatedAt: productionUpdatedAt(snapshot.get('updatedAt')),
        status: snapshot.get('status'), version: productionVersion(snapshot.get('version')),
      })),
      members: members.docs.flatMap((member, index) => {
        const profile = profiles[index].data();
        return profile?.active === true && profile.accountType === 'atelier_member' && profile.atelierId === atelierId
          ? [{ id: member.id, name: String(profile.name ?? profile.email ?? 'Membro'), role: String(member.get('role')) }] : [];
      }),
    };
  });
});

export const saveOrderProductionConfiguration = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const input = plainData(call.data);
  if (Object.keys(input).some((key) => !['atelierId', 'orderId', 'requestId', 'expectedVersion', 'stages'].includes(key))) throw new HttpsError('invalid-argument', 'Há campos fora do contrato.');
  const atelierId = productionId(input.atelierId, 'Ateliê');
  const orderId = productionId(input.orderId, 'Pedido');
  const requestId = productionId(input.requestId, 'Identificador da operação');
  if (!Number.isSafeInteger(input.expectedVersion) || Number(input.expectedVersion) < 0) throw new HttpsError('invalid-argument', 'A versão esperada da configuração é obrigatória.');
  const next = parseStages(input.stages);
  await requireOrderManager(atelierId, call.auth!.uid, 'orders:manage');
  const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
  const operationRef = orderRef.collection('productionOperations').doc(productionOperationId(call.auth!.uid, requestId));
  const fingerprint = productionFingerprint({ action: 'configure', expectedVersion: input.expectedVersion, stages: next });
  return adminDb.runTransaction(async (transaction) => {
    const [, orderSnapshot, stageSnapshots, operation, slots, photos, approvals] = await Promise.all([
      readProductionManager(transaction, atelierId, call.auth!.uid), transaction.get(orderRef),
      transaction.get(orderRef.collection('productionStages').orderBy('order', 'asc')), transaction.get(operationRef),
      transaction.get(adminDb.collection(`ateliers/${atelierId}/productionSlots`).where('orderId', '==', orderId)),
      transaction.get(orderRef.collection('photos')), transaction.get(orderRef.collection('approvals')),
    ]);
    if (!orderSnapshot.exists) throw new HttpsError('not-found', 'Pedido não encontrado.');
    if (operation.exists) {
      if (operation.get('fingerprint') !== fingerprint) throw new HttpsError('already-exists', 'Esta chave de operação já foi utilizada com outra configuração.');
      return { ...operation.get('result'), replayed: true };
    }
    const order = orderSnapshot.data()!;
    if (!['confirmed', 'scheduled', 'modeling', 'in_production', 'fitting', 'adjustments', 'finishing', 'paused', 'waiting_final_payment', 'ready_to_ship'].includes(String(order.status))) throw new HttpsError('failed-precondition', 'A configuração só pode ser alterada em um pedido ativo com entrada confirmada.');
    const version = productionVersion(order.productionConfigurationVersion);
    if (version !== input.expectedVersion) throw new HttpsError('aborted', 'A configuração mudou. Atualize a tela antes de salvar.');
    const existing: Array<Record<string, unknown> & { id: string }> = stageSnapshots.docs.map((snapshot) => ({ ...snapshot.data(), id: snapshot.id }));
    const invalid = validateProductionConfiguration(next, existing);
    if (invalid) throw new HttpsError('failed-precondition', invalid);
    for (const snapshot of stageSnapshots.docs) {
      const desired = next.find((stage) => stage.id === snapshot.id);
      if (desired && desired.expectedUpdatedAt !== productionUpdatedAt(snapshot.get('updatedAt'))) throw new HttpsError('aborted', 'Uma etapa ou sua agenda mudou. Atualize a configuração.');
    }
    for (const desired of next) {
      if (!existing.some((stage) => stage.id === desired.id) && desired.expectedUpdatedAt !== null) throw new HttpsError('invalid-argument', 'Uma nova etapa não pode informar uma revisão anterior.');
    }
    const members = [...new Set(next.flatMap((stage) => {
      const prior = existing.find((item) => item.id === stage.id);
      const preservedHistoricalAssignment = prior && ['completed', 'approved', 'waiting_approval'].includes(String(prior.status))
        && (prior.assignedTo ?? null) === stage.assignedTo;
      return stage.assignedTo && !preservedHistoricalAssignment ? [stage.assignedTo] : [];
    }))];
    const assigned = await Promise.all(members.map(async (uid) => {
      const [member, profile] = await Promise.all([transaction.get(adminDb.doc(`ateliers/${atelierId}/members/${uid}`)), transaction.get(adminDb.doc(`users/${uid}`))]);
      return { uid, member: member.data(), profile: profile.data() };
    }));
    for (const person of assigned) {
      if (person.member?.active !== true || person.profile?.active !== true || person.profile.atelierId !== atelierId || person.profile.accountType !== 'atelier_member') throw new HttpsError('failed-precondition', 'O responsável precisa ser um membro ativo deste ateliê.');
    }
    const structurallyChanged = stageSnapshots.docs.filter((snapshot) => {
      const desiredIndex = next.findIndex((stage) => stage.id === snapshot.id);
      return desiredIndex < 0 || desiredIndex !== snapshot.get('order');
    });
    const updateHistories = await Promise.all(structurallyChanged.map((stage) => transaction.get(stage.ref.collection('updates').limit(1))));
    structurallyChanged.forEach((stage, index) => {
      if (!updateHistories[index].empty || slots.docs.some((slot) => slot.get('stageId') === stage.id)
        || photos.docs.some((photo) => photo.get('stageId') === stage.id) || approvals.docs.some((approval) => approval.get('stageId') === stage.id)) throw new HttpsError('failed-precondition', 'Uma etapa com execução, foto, aprovação ou alocação histórica não pode ser removida ou reordenada.');
    });
    for (const stage of next) {
      const prior = existing.find((item) => item.id === stage.id);
      const scheduled = slots.docs.filter((slot) => slot.get('stageId') === stage.id && slot.get('status') === 'scheduled');
      if (scheduled.some((slot) => slot.get('assignedTo') !== stage.assignedTo)) throw new HttpsError('failed-precondition', 'Cancele as horas alocadas antes de mudar o responsável da etapa.');
      if (scheduled.some((slot) => (stage.deadline && String(slot.get('date')) > stage.deadline)
        || (stage.plannedStartDate && String(slot.get('date')) < stage.plannedStartDate))) throw new HttpsError('failed-precondition', 'As datas precisam incluir as horas já alocadas na agenda.');
      if (prior?.status === 'waiting_approval' && ((prior.assignedTo ?? null) !== stage.assignedTo || (prior.deadline ?? null) !== stage.deadline || (prior.plannedStartDate ?? null) !== stage.plannedStartDate)) throw new HttpsError('failed-precondition', 'A etapa aguardando aprovação deve preservar a configuração enviada ao cliente.');
    }
    const now = Timestamp.now();
    const configuration = next.map((stage, order) => ({
      id: stage.id, name: stage.name, progressWeight: stage.progressWeight, requiresClientApproval: stage.requiresClientApproval,
      semanticKey: stage.semanticKey, assignedTo: stage.assignedTo, plannedStartDate: stage.plannedStartDate, deadline: stage.deadline, order,
    }));
    const progress = calculateWeightedProductionProgress(configuration.map((stage) => ({ progress: Number(existing.find((item) => item.id === stage.id)?.progress ?? 0), progressWeight: stage.progressWeight })));
    const firstWorkPending = configuration.find((stage) => stage.id !== 'stage-shipping'
      && !['completed', 'approved'].includes(String(existing.find((item) => item.id === stage.id)?.status ?? 'pending')));
    let nextOrderStatus = String(order.status);
    if (firstWorkPending && ['ready_to_ship', 'waiting_final_payment'].includes(nextOrderStatus)) {
      nextOrderStatus = productionSemantic(firstWorkPending);
    } else if (!firstWorkPending && nextOrderStatus !== 'paused') {
      let remainingCents: number;
      try { remainingCents = orderRemainingCents(order); }
      catch { throw new HttpsError('failed-precondition', 'O saldo do pedido precisa de revisão antes de atualizar a configuração final.'); }
      nextOrderStatus = remainingCents === 0 ? 'ready_to_ship' : 'waiting_final_payment';
    }
    for (const stage of configuration) {
      const reference = orderRef.collection('productionStages').doc(stage.id);
      const prior = existing.find((item) => item.id === stage.id);
      if (prior) {
        const unchanged = prior.name === stage.name && prior.order === stage.order && prior.progressWeight === stage.progressWeight
          && prior.requiresClientApproval === stage.requiresClientApproval && (canonicalProductionSemantics[prior.id] ?? prior.semanticKey) === stage.semanticKey
          && (prior.assignedTo ?? null) === stage.assignedTo && (prior.plannedStartDate ?? null) === stage.plannedStartDate && (prior.deadline ?? null) === stage.deadline;
        if (!unchanged) transaction.update(reference, { ...stage, version: productionVersion(prior.version) + 1, updatedAt: now });
      }
      else transaction.create(reference, { ...stage, atelierId, orderId, status: 'pending', progress: 0, version: 1, createdAt: now, updatedAt: now });
    }
    for (const prior of existing.filter((stage) => !configuration.some((item) => item.id === stage.id))) transaction.delete(orderRef.collection('productionStages').doc(prior.id));
    const result = { orderId, version: version + 1, progress, status: nextOrderStatus, replayed: false };
    transaction.update(orderRef, { productionConfigurationVersion: version + 1, progress, status: nextOrderStatus, updatedAt: now });
    transaction.create(orderRef.collection('productionConfigurations').doc(String(version + 1)), { version: version + 1, actorId: call.auth!.uid, stages: configuration, previousStages: existing, createdAt: now, requestId });
    transaction.create(orderRef.collection('statusHistory').doc(), { status: nextOrderStatus, actorId: call.auth!.uid, source: 'production_configuration_updated', configurationVersion: version + 1, createdAt: now });
    transaction.create(operationRef, { action: 'configure', actorId: call.auth!.uid, requestId, fingerprint, result, createdAt: now });
    transaction.create(adminDb.collection('auditLogs').doc(), { actorId: call.auth!.uid, atelierId, action: 'production.configuration_updated', entity: 'order', entityId: orderId, before: { version, status: order.status, stageIds: existing.map((stage) => stage.id) }, after: { version: version + 1, status: nextOrderStatus, stageIds: configuration.map((stage) => stage.id) }, timestamp: FieldValue.serverTimestamp() });
    return result;
  });
});
