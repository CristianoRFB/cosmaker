import { createHash } from 'node:crypto';
import { FieldPath, Timestamp, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireVerifiedIdentity } from './access';
import { agreementFingerprint, changeApplicationFinancials, currentOrderAgreement, OrderChangePolicyError, proposedOrderAgreement, validAgreementDate, type OrderChangeTerms } from './change-policy';
import { defaultProductionStages, productionSemantic } from './production-template';

type ChangeStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested' | 'cancelled' | 'applied';
type AuthIdentity = { uid: string; token: Record<string, unknown> };

function payload(value: unknown, allowed: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpsError('invalid-argument', 'Informe os dados da alteração.');
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !allowed.includes(key))) throw new HttpsError('invalid-argument', 'A solicitação contém campos não permitidos.');
  return data;
}

function id(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(value)) throw new HttpsError('invalid-argument', `${label} inválido.`);
  return value;
}

function text(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new HttpsError('invalid-argument', `${label} deve ter entre ${min} e ${max} caracteres.`);
  return value.trim();
}

function version(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new HttpsError('invalid-argument', 'Informe a versão do acordo exibida na tela.');
  return value;
}

function fingerprint(value: unknown) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new HttpsError('invalid-argument', 'Atualize a proposta antes de responder.');
  return value;
}

function policy<T>(action: () => T): T {
  try { return action(); } catch (error) {
    if (error instanceof OrderChangePolicyError) throw new HttpsError('failed-precondition', error.message);
    throw error;
  }
}

function can(member: FirebaseFirestore.DocumentData, permission: 'orders:read' | 'orders:manage' | 'payments:write') {
  const permissions = Array.isArray(member.permissions) ? member.permissions : [];
  return member.role === 'owner' || member.role === 'admin' || permissions.includes(permission)
    || (permission === 'orders:read' && permissions.includes('orders:manage'))
    || (permission === 'payments:write' && permissions.includes('finance:write'));
}

/** Rechecks workspace membership or the verified, linked order client in the same transaction as every mutation. */
async function actor(transaction: Transaction, atelierId: string, order: FirebaseFirestore.DocumentData, auth: AuthIdentity, mode: 'read' | 'manage' | 'client', financial = false) {
  const [atelierSnapshot, profileSnapshot, memberSnapshot] = await Promise.all([
    transaction.get(adminDb.doc(`ateliers/${atelierId}`)), transaction.get(adminDb.doc(`users/${auth.uid}`)),
    transaction.get(adminDb.doc(`ateliers/${atelierId}/members/${auth.uid}`)),
  ]);
  const atelier = atelierSnapshot.data();
  const profile = profileSnapshot.data();
  const member = memberSnapshot.data();
  if (!atelierSnapshot.exists || atelier?.active !== true || !profileSnapshot.exists || profile?.active !== true) throw new HttpsError('permission-denied', 'Sua conta ou o ateliê não está ativo.');
  const manager = profile.accountType === 'atelier_member' && profile.atelierId === atelierId
    && memberSnapshot.exists && member?.active === true && can(member, mode === 'manage' ? 'orders:manage' : 'orders:read');
  if (mode !== 'client' && manager) {
    if (financial && (!can(member!, 'payments:write') || atelier.demoWorkspace === true)) throw new HttpsError('permission-denied', 'A alteração de valor exige permissão financeira em um ateliê operacional.');
    return { kind: 'staff' as const, atelier: atelier! };
  }
  if (mode === 'manage' || profile.accountType !== 'client') throw new HttpsError('permission-denied', 'Seu perfil não pode acessar esta alteração.');
  const email = typeof auth.token.email === 'string' ? auth.token.email.trim().toLowerCase() : '';
  if (!email || typeof order.email !== 'string' || order.email.trim().toLowerCase() !== email) throw new HttpsError('permission-denied', 'Este pedido não pertence à sua conta verificada.');
  if (typeof order.clientUserId === 'string' && order.clientUserId !== auth.uid) throw new HttpsError('permission-denied', 'Este pedido está vinculado a outra conta.');
  let linked = order.clientUserId === auth.uid;
  if (typeof order.clientId === 'string' && order.clientId && !order.clientId.includes('/')) {
    const client = await transaction.get(adminDb.doc(`ateliers/${atelierId}/clients/${order.clientId}`));
    if (typeof client.data()?.userId === 'string' && client.data()?.userId !== auth.uid) throw new HttpsError('permission-denied', 'O cadastro do cliente está vinculado a outra conta.');
    linked = linked || client.data()?.userId === auth.uid;
  }
  if (!linked) throw new HttpsError('permission-denied', 'O pedido precisa estar vinculado à sua conta antes de responder.');
  return { kind: 'client' as const, atelier: atelier! };
}

function mutableOrder(order: FirebaseFirestore.DocumentData) {
  if (['cancelled', 'refunded', 'shipped', 'delivered', 'completed'].includes(String(order.status))) throw new HttpsError('failed-precondition', 'Este pedido já encerrou a fase em que o acordo pode mudar.');
}

function assertBase(order: FirebaseFirestore.DocumentData, change: FirebaseFirestore.DocumentData) {
  const current = policy(() => currentOrderAgreement(order));
  if (current.version !== change.baseAgreementVersion || agreementFingerprint(current) !== change.baseAgreementFingerprint) throw new HttpsError('aborted', 'O acordo mudou depois desta proposta. O ateliê precisa emitir uma nova revisão.');
  return current;
}

function operationFingerprint(action: string, uid: string, data: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify([action, uid, data])).digest('hex');
}

function history(transaction: Transaction, orderRef: FirebaseFirestore.DocumentReference, auth: AuthIdentity, action: string, order: FirebaseFirestore.DocumentData, changeId: string, changeVersion: number, now: Timestamp, after: Record<string, unknown>) {
  transaction.create(orderRef.collection('statusHistory').doc(), {
    status: typeof after.orderStatus === 'string' ? after.orderStatus : order.status, actorId: auth.uid, source: `order_change_${action}`, changeRequestId: changeId, changeVersion,
    ...after, createdAt: now,
  });
  transaction.create(adminDb.collection('auditLogs').doc(), {
    actorId: auth.uid, atelierId: orderRef.parent.parent!.id, action: `order.change_${action}`, entity: 'order_change', entityId: changeId,
    before: { orderId: orderRef.id, orderStatus: order.status, agreementVersion: order.agreementVersion ?? 0 },
    after: { changeVersion, ...after }, timestamp: now,
  });
}

function serializedChange(document: FirebaseFirestore.DocumentSnapshot) {
  const data = document.data()!;
  const iso = (value: unknown) => value instanceof Timestamp ? value.toDate().toISOString() : null;
  return { id: document.id, ...data, createdAt: iso(data.createdAt), respondedAt: iso(data.respondedAt), appliedAt: iso(data.appliedAt), cancelledAt: iso(data.cancelledAt),
    approval: data.approval ? { ...data.approval, approvedAt: iso(data.approval.approvedAt) } : null };
}

export const listOrderChangeRequests = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = payload(call.data, ['atelierId', 'orderId', 'cursor', 'pageSize']);
  const atelierId = id(data.atelierId, 'Ateliê');
  const orderId = id(data.orderId, 'Pedido');
  const pageSize = data.pageSize === undefined ? 20 : data.pageSize;
  if (typeof pageSize !== 'number' || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 30) throw new HttpsError('invalid-argument', 'A página deve conter entre 1 e 30 alterações.');
  const cursor = data.cursor === undefined ? null : id(data.cursor, 'Cursor');
  const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
  return adminDb.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) throw new HttpsError('not-found', 'Pedido não encontrado.');
    const order = orderSnapshot.data()!;
    const viewer = await actor(transaction, atelierId, order, call.auth!, 'read');
    let query = orderRef.collection('changeRequests').orderBy('version', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(pageSize + 1);
    if (cursor) {
      const last = await transaction.get(orderRef.collection('changeRequests').doc(cursor));
      if (!last.exists) throw new HttpsError('invalid-argument', 'Página de alterações não encontrada.');
      query = query.startAfter(last);
    }
    const requests = await transaction.get(query);
    const documents = requests.docs.slice(0, pageSize);
    const currentAgreement = policy(() => currentOrderAgreement(order));
    return { requests: documents.map(serializedChange), currentAgreement, currentAgreementFingerprint: agreementFingerprint(currentAgreement), viewer: viewer.kind,
      nextCursor: requests.size > pageSize ? documents.at(-1)!.id : null };
  });
});

export const proposeOrderChangeRequest = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = payload(call.data, ['atelierId', 'orderId', 'requestId', 'baseAgreementVersion', 'baseAgreementFingerprint', 'reason', 'changes', 'supersedesId']);
  const atelierId = id(data.atelierId, 'Ateliê');
  const orderId = id(data.orderId, 'Pedido');
  const requestId = id(data.requestId, 'Identificador da solicitação');
  const baseVersion = version(data.baseAgreementVersion);
  const baseFingerprint = fingerprint(data.baseAgreementFingerprint);
  const reason = text(data.reason, 'Motivo', 5, 1000);
  const rawChanges = payload(data.changes, ['scope', 'materials', 'expectedDeliveryDate', 'valueDeltaCents']);
  const changes: OrderChangeTerms = {};
  if (rawChanges.scope !== undefined) changes.scope = text(rawChanges.scope, 'Escopo', 5, 3000);
  if (rawChanges.materials !== undefined) changes.materials = text(rawChanges.materials, 'Materiais', 1, 1500);
  if (rawChanges.expectedDeliveryDate !== undefined) {
    if (!validAgreementDate(rawChanges.expectedDeliveryDate)) throw new HttpsError('invalid-argument', 'Data de entrega inválida.');
    changes.expectedDeliveryDate = rawChanges.expectedDeliveryDate;
  }
  if (rawChanges.valueDeltaCents !== undefined) {
    if (typeof rawChanges.valueDeltaCents !== 'number' || !Number.isSafeInteger(rawChanges.valueDeltaCents)) throw new HttpsError('invalid-argument', 'A variação de valor precisa usar centavos inteiros.');
    changes.valueDeltaCents = rawChanges.valueDeltaCents;
  }
  if (!Object.keys(changes).length) throw new HttpsError('invalid-argument', 'Informe ao menos uma condição alterada.');
  const supersedesId = data.supersedesId === undefined ? null : id(data.supersedesId, 'Revisão anterior');
  const inputFingerprint = operationFingerprint('propose', call.auth!.uid, { atelierId, orderId, baseVersion, baseFingerprint, reason, changes, supersedesId });
  const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
  const changeRef = orderRef.collection('changeRequests').doc(requestId);
  return adminDb.runTransaction(async (transaction) => {
    const [orderSnapshot, existing] = await Promise.all([transaction.get(orderRef), transaction.get(changeRef)]);
    if (!orderSnapshot.exists) throw new HttpsError('not-found', 'Pedido não encontrado.');
    const order = orderSnapshot.data()!;
    await actor(transaction, atelierId, order, call.auth!, 'manage', (changes.valueDeltaCents ?? 0) !== 0);
    if (existing.exists) {
      if (existing.data()?.inputFingerprint !== inputFingerprint) throw new HttpsError('already-exists', 'Este identificador já pertence a outra alteração.');
      return { changeRequestId: requestId, version: existing.data()!.version as number, status: existing.data()!.status as ChangeStatus, alreadyApplied: true };
    }
    mutableOrder(order);
    const base = policy(() => currentOrderAgreement(order));
    if (base.version !== baseVersion || agreementFingerprint(base) !== baseFingerprint) throw new HttpsError('aborted', 'O acordo exibido ficou desatualizado. Atualize a tela para propor a mudança.');
    const proposed = policy(() => proposedOrderAgreement(base, changes));
    policy(() => changeApplicationFinancials(order, proposed));
    const previous = supersedesId ? await transaction.get(orderRef.collection('changeRequests').doc(supersedesId)) : null;
    if (previous && (!previous.exists || !['rejected', 'changes_requested', 'cancelled'].includes(String(previous.data()?.status)) || previous.data()?.supersededBy)) throw new HttpsError('failed-precondition', 'A revisão anterior já foi substituída ou ainda aguarda conclusão.');
    const previousVersion = order.lastChangeRequestVersion ?? 0;
    if (!Number.isSafeInteger(previousVersion) || Number(previousVersion) < 0 || !Number.isSafeInteger(Number(previousVersion) + 1)) throw new HttpsError('failed-precondition', 'O contador de revisões precisa ser revisado.');
    const changeVersion = Number(previousVersion) + 1;
    const now = Timestamp.now();
    transaction.create(changeRef, {
      atelierId, orderId, version: changeVersion, status: 'pending', requestedBy: call.auth!.uid, reason, changes,
      baseAgreementVersion: base.version, baseAgreementFingerprint: baseFingerprint, baseAgreementSnapshot: base,
      proposedAgreementSnapshot: proposed, proposalFingerprint: agreementFingerprint(proposed), inputFingerprint,
      supersedesId, supersededBy: null, approval: null, createdAt: now,
    });
    if (previous) transaction.update(previous.ref, { supersededBy: requestId });
    transaction.update(orderRef, { lastChangeRequestVersion: changeVersion, updatedAt: now });
    history(transaction, orderRef, call.auth!, 'proposed', order, requestId, changeVersion, now, { baseAgreementVersion: base.version, valueDeltaCents: changes.valueDeltaCents ?? 0 });
    if (typeof order.clientUserId === 'string' && order.clientUserId) transaction.create(adminDb.doc(`ateliers/${atelierId}/notifications/order-change-${orderId}-${requestId}`), {
      userId: order.clientUserId, type: 'order_change_proposed', title: 'Alteração de acordo para revisar',
      message: 'O ateliê enviou uma revisão de escopo, materiais, prazo ou valor. Revise as condições no pedido.',
      orderId, changeRequestId: requestId, read: false, createdAt: now,
    });
    return { changeRequestId: requestId, version: changeVersion, status: 'pending' as const, alreadyApplied: false };
  });
});

export const respondToOrderChangeRequest = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = payload(call.data, ['atelierId', 'orderId', 'changeRequestId', 'requestId', 'version', 'proposalFingerprint', 'decision', 'comment', 'confirmed']);
  const atelierId = id(data.atelierId, 'Ateliê');
  const orderId = id(data.orderId, 'Pedido');
  const changeRequestId = id(data.changeRequestId, 'Alteração');
  const requestId = id(data.requestId, 'Identificador da resposta');
  const changeVersion = version(data.version);
  const proposalFingerprint = fingerprint(data.proposalFingerprint);
  if (!['approved', 'rejected', 'changes_requested'].includes(String(data.decision))) throw new HttpsError('invalid-argument', 'Escolha aprovar, recusar ou solicitar ajustes.');
  const decision = data.decision as 'approved' | 'rejected' | 'changes_requested';
  const comment = text(data.comment ?? '', 'Comentário', decision === 'approved' ? 0 : 5, 1000);
  if (decision === 'approved' && data.confirmed !== true) throw new HttpsError('invalid-argument', 'Confirme explicitamente as condições desta revisão antes de aprovar.');
  const inputFingerprint = operationFingerprint('respond', call.auth!.uid, { changeRequestId, changeVersion, proposalFingerprint, decision, comment, confirmed: data.confirmed === true });
  const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
  const changeRef = orderRef.collection('changeRequests').doc(changeRequestId);
  const operationRef = orderRef.collection('changeRequestOperations').doc(requestId);
  return adminDb.runTransaction(async (transaction) => {
    const [orderSnapshot, changeSnapshot, previous] = await Promise.all([transaction.get(orderRef), transaction.get(changeRef), transaction.get(operationRef)]);
    if (!orderSnapshot.exists || !changeSnapshot.exists) throw new HttpsError('not-found', 'Pedido ou alteração não encontrada.');
    const order = orderSnapshot.data()!;
    const change = changeSnapshot.data()!;
    await actor(transaction, atelierId, order, call.auth!, 'client');
    if (previous.exists) {
      if (previous.data()?.inputFingerprint !== inputFingerprint) throw new HttpsError('already-exists', 'Esta resposta já foi utilizada com outros dados.');
      return { changeRequestId, status: previous.data()!.status as ChangeStatus, alreadyApplied: true };
    }
    mutableOrder(order);
    if (change.status !== 'pending' || change.version !== changeVersion || change.proposalFingerprint !== proposalFingerprint) throw new HttpsError('failed-precondition', 'Esta revisão já recebeu resposta ou não corresponde à proposta exibida.');
    assertBase(order, change);
    const now = Timestamp.now();
    const approval = decision === 'approved' ? {
      clientUserId: call.auth!.uid, emailVerified: true, changeVersion, baseAgreementVersion: change.baseAgreementVersion,
      proposalFingerprint, agreementSnapshot: change.proposedAgreementSnapshot, approvedAt: now,
    } : null;
    transaction.update(changeRef, { status: decision, respondedBy: call.auth!.uid, responseComment: comment, respondedAt: now, approval });
    transaction.create(changeRef.collection('events').doc(requestId), { action: decision, actorId: call.auth!.uid, comment, proposalFingerprint, createdAt: now });
    transaction.create(operationRef, { inputFingerprint, action: 'respond', changeRequestId, actorId: call.auth!.uid, status: decision, createdAt: now });
    history(transaction, orderRef, call.auth!, decision, order, changeRequestId, changeVersion, now, { proposalFingerprint });
    return { changeRequestId, status: decision, alreadyApplied: false };
  });
});

export const applyOrderChangeRequest = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = payload(call.data, ['atelierId', 'orderId', 'changeRequestId', 'requestId', 'version', 'proposalFingerprint']);
  const atelierId = id(data.atelierId, 'Ateliê');
  const orderId = id(data.orderId, 'Pedido');
  const changeRequestId = id(data.changeRequestId, 'Alteração');
  const requestId = id(data.requestId, 'Identificador da aplicação');
  const changeVersion = version(data.version);
  const proposalFingerprint = fingerprint(data.proposalFingerprint);
  const inputFingerprint = operationFingerprint('apply', call.auth!.uid, { changeRequestId, changeVersion, proposalFingerprint });
  const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
  const changeRef = orderRef.collection('changeRequests').doc(changeRequestId);
  const operationRef = orderRef.collection('changeRequestOperations').doc(requestId);
  return adminDb.runTransaction(async (transaction) => {
    const [orderSnapshot, changeSnapshot, previous] = await Promise.all([transaction.get(orderRef), transaction.get(changeRef), transaction.get(operationRef)]);
    if (!orderSnapshot.exists || !changeSnapshot.exists) throw new HttpsError('not-found', 'Pedido ou alteração não encontrada.');
    const order = orderSnapshot.data()!;
    const change = changeSnapshot.data()!;
    await actor(transaction, atelierId, order, call.auth!, 'manage', (change.changes?.valueDeltaCents ?? 0) !== 0);
    if (previous.exists) {
      if (previous.data()?.inputFingerprint !== inputFingerprint) throw new HttpsError('already-exists', 'Esta aplicação já foi utilizada com outros dados.');
      return { changeRequestId, status: 'applied' as const, agreementVersion: previous.data()!.agreementVersion as number, alreadyApplied: true };
    }
    if (change.status === 'applied' && change.version === changeVersion && change.proposalFingerprint === proposalFingerprint) return { changeRequestId, status: 'applied' as const, agreementVersion: change.appliedAgreementVersion as number, alreadyApplied: true };
    mutableOrder(order);
    if (change.status !== 'approved' || change.version !== changeVersion || change.proposalFingerprint !== proposalFingerprint) throw new HttpsError('failed-precondition', 'A aplicação exige a aprovação explícita desta revisão pelo cliente.');
    const base = assertBase(order, change);
    const proposed = policy(() => proposedOrderAgreement(base, change.changes));
    const approvedSnapshot = policy(() => currentOrderAgreement({ currentAgreement: change.approval?.agreementSnapshot,
      agreementVersion: proposed.version, description: proposed.scope, expectedDeliveryDate: proposed.expectedDeliveryDate }));
    if (agreementFingerprint(proposed) !== proposalFingerprint || change.approval?.proposalFingerprint !== proposalFingerprint
      || change.approval?.emailVerified !== true || change.approval?.changeVersion !== changeVersion
      || agreementFingerprint(approvedSnapshot) !== proposalFingerprint
      || (typeof order.clientUserId === 'string' && change.approval?.clientUserId !== order.clientUserId)) throw new HttpsError('failed-precondition', 'O snapshot aprovado pelo cliente não corresponde à alteração.');
    const approvingUid = id(change.approval.clientUserId, 'Conta responsável pela aprovação');
    const clientLink = typeof order.clientId === 'string' && order.clientId && !order.clientId.includes('/')
      ? await transaction.get(adminDb.doc(`ateliers/${atelierId}/clients/${order.clientId}`)) : null;
    if ((typeof clientLink?.data()?.userId === 'string' && clientLink.data()!.userId !== approvingUid)
      || (order.clientUserId !== approvingUid && clientLink?.data()?.userId !== approvingUid)) throw new HttpsError('failed-precondition', 'O vínculo do cliente mudou após a aprovação. Uma nova revisão precisa ser aprovada pela conta vinculada.');
    const financials = policy(() => changeApplicationFinancials(order, proposed));
    let nextOrderStatus = order.status;
    if (['ready_to_ship', 'waiting_final_payment'].includes(String(order.status))) {
      const stages = await transaction.get(orderRef.collection('productionStages').orderBy('order', 'asc'));
      if (stages.docs.at(-1)?.id !== 'stage-shipping' || defaultProductionStages.some((stage) => !stages.docs.some((document) => document.id === stage.id))) {
        throw new HttpsError('failed-precondition', 'As etapas da produção precisam de revisão antes de atualizar o estado financeiro final.');
      }
      const unfinishedWork = stages.docs.find((stage) => stage.id !== 'stage-shipping' && !['completed', 'approved'].includes(String(stage.get('status'))));
      if (unfinishedWork) {
        try { nextOrderStatus = productionSemantic({ id: unfinishedWork.id, semanticKey: unfinishedWork.get('semanticKey') }); }
        catch { throw new HttpsError('failed-precondition', 'A etapa pendente não tem uma fase operacional válida. Revise a produção antes de aplicar.'); }
      } else nextOrderStatus = financials.remainingCents === 0 ? 'ready_to_ship' : 'waiting_final_payment';
    }
    const agreementRef = orderRef.collection('agreementVersions').doc(String(proposed.version));
    const baseRef = orderRef.collection('agreementVersions').doc(String(base.version));
    const [existingAgreement, existingBase] = await Promise.all([transaction.get(agreementRef), transaction.get(baseRef)]);
    if (existingAgreement.exists) throw new HttpsError('aborted', 'Outra revisão já foi aplicada nesta versão do acordo.');
    const now = Timestamp.now();
    if (!existingBase.exists) transaction.create(baseRef, { agreementSnapshot: base, fingerprint: agreementFingerprint(base), source: base.version === 0 ? 'approved_quote' : 'legacy_agreement', capturedAt: now });
    transaction.create(agreementRef, { agreementSnapshot: proposed, fingerprint: proposalFingerprint, baseAgreementSnapshot: base,
      source: 'approved_change_request', changeRequestId, changeVersion, approvedBy: change.approval.clientUserId,
      approvedAt: change.approval.approvedAt, appliedBy: call.auth!.uid, appliedAt: now });
    transaction.update(orderRef, { description: proposed.scope, expectedDeliveryDate: proposed.expectedDeliveryDate, status: nextOrderStatus,
      currentAgreement: proposed, agreementVersion: proposed.version, totalAmountCents: proposed.totalCents,
      amountRemaining: financials.remainingCents / 100, amountRemainingCents: financials.remainingCents,
      ...(proposed.expectedDeliveryDate !== base.expectedDeliveryDate ? { planningNeedsReview: true, planningChangeReason: 'approved_order_change', planningChangedAt: now } : {}), updatedAt: now });
    transaction.update(changeRef, { status: 'applied', appliedBy: call.auth!.uid, appliedAt: now, appliedAgreementVersion: proposed.version });
    transaction.create(changeRef.collection('events').doc(requestId), { action: 'applied', actorId: call.auth!.uid, agreementVersion: proposed.version, createdAt: now });
    transaction.create(operationRef, { inputFingerprint, action: 'apply', changeRequestId, actorId: call.auth!.uid, status: 'applied', agreementVersion: proposed.version, createdAt: now });
    history(transaction, orderRef, call.auth!, 'applied', order, changeRequestId, changeVersion, now, { agreementVersion: proposed.version, proposalFingerprint, totalCents: proposed.totalCents, remainingCents: financials.remainingCents, orderStatus: nextOrderStatus });
    return { changeRequestId, status: 'applied' as const, agreementVersion: proposed.version, alreadyApplied: false };
  });
});

export const cancelOrderChangeRequest = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = payload(call.data, ['atelierId', 'orderId', 'changeRequestId', 'requestId', 'reason']);
  const atelierId = id(data.atelierId, 'Ateliê');
  const orderId = id(data.orderId, 'Pedido');
  const changeRequestId = id(data.changeRequestId, 'Alteração');
  const requestId = id(data.requestId, 'Identificador do cancelamento');
  const reason = text(data.reason, 'Motivo', 5, 1000);
  const inputFingerprint = operationFingerprint('cancel', call.auth!.uid, { changeRequestId, reason });
  const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
  const changeRef = orderRef.collection('changeRequests').doc(changeRequestId);
  const operationRef = orderRef.collection('changeRequestOperations').doc(requestId);
  return adminDb.runTransaction(async (transaction) => {
    const [orderSnapshot, changeSnapshot, previous] = await Promise.all([transaction.get(orderRef), transaction.get(changeRef), transaction.get(operationRef)]);
    if (!orderSnapshot.exists || !changeSnapshot.exists) throw new HttpsError('not-found', 'Pedido ou alteração não encontrada.');
    const order = orderSnapshot.data()!;
    const change = changeSnapshot.data()!;
    await actor(transaction, atelierId, order, call.auth!, 'manage');
    if (previous.exists) {
      if (previous.data()?.inputFingerprint !== inputFingerprint) throw new HttpsError('already-exists', 'Este cancelamento já foi utilizado com outros dados.');
      return { changeRequestId, status: 'cancelled' as const, alreadyApplied: true };
    }
    if (!['pending', 'approved'].includes(String(change.status))) throw new HttpsError('failed-precondition', 'Somente revisões pendentes ou aprovadas ainda não aplicadas podem ser canceladas.');
    const now = Timestamp.now();
    transaction.update(changeRef, { status: 'cancelled', cancelledBy: call.auth!.uid, cancelReason: reason, cancelledAt: now });
    transaction.create(changeRef.collection('events').doc(requestId), { action: 'cancelled', actorId: call.auth!.uid, comment: reason, createdAt: now });
    transaction.create(operationRef, { inputFingerprint, action: 'cancel', changeRequestId, actorId: call.auth!.uid, status: 'cancelled', createdAt: now });
    history(transaction, orderRef, call.auth!, 'cancelled', order, changeRequestId, change.version, now, {});
    return { changeRequestId, status: 'cancelled' as const, alreadyApplied: false };
  });
});
