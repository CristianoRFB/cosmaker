import { randomBytes } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getFeatureDefinition, getLimitDefinition, getPlanDefinition, isPlanId, PRICING_TERMS } from './catalog';
import { validateCommercialState } from './entitlements';
import type { SubscriptionStatus, TenantCommercialState } from './types';
import { adminAuth, adminDb } from '../admin';
import { requirePlatformAdmin } from '../platform/platform-admin';
import { commercialConfigRef, commercialStateRef, isFunctionsEmulator } from './data';

const assignableStatuses = new Set<SubscriptionStatus>(['active', 'past_due', 'suspended', 'cancelled']);

function requireExactKeys(data: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(data).some((key) => !allowed.includes(key))) throw new HttpsError('invalid-argument', 'A solicitação contém campos não permitidos.');
}

function requireReason(value: unknown) {
  if (typeof value !== 'string' || value.trim().length < 8 || value.trim().length > 500) {
    throw new HttpsError('invalid-argument', 'Informe um motivo entre 8 e 500 caracteres.');
  }
  return value.trim();
}

function requireAtelierId(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 150 || value.includes('/')) {
    throw new HttpsError('invalid-argument', 'Identificador do ateliê inválido.');
  }
  return value.trim();
}

async function requireAdminCall(call: { auth?: { uid: string; token: Record<string, unknown> } | null }) {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  if (call.auth.token.platformAdmin !== true) throw new HttpsError('permission-denied', 'Esta operação comercial exige autorização global da plataforma.');
  await requirePlatformAdmin(call.auth.uid, call.auth.token);
  return call.auth;
}

function readStateOrPending(value: unknown, allowTestOnly: boolean): TenantCommercialState | null {
  if (value === undefined || value === null) return null;
  try { return validateCommercialState(value, allowTestOnly); }
  catch { throw new HttpsError('failed-precondition', 'O estado comercial existente é inválido e precisa ser revisado.'); }
}

function makeState(planId: TenantCommercialState['planId'], subscriptionStatus: SubscriptionStatus, previous?: TenantCommercialState | null, trialUntil?: string | null): TenantCommercialState {
  return {
    planId,
    subscriptionStatus,
    trialUntil: trialUntil === undefined ? previous?.trialUntil ?? null : trialUntil,
    entitlementOverrides: previous?.entitlementOverrides ?? {},
    limitOverrides: previous?.limitOverrides ?? {},
  };
}

async function commitCommercialChange(options: {
  atelierId: string;
  actorId: string;
  reason: string;
  action: string;
  nextState: TenantCommercialState;
  before: TenantCommercialState | null;
}) {
  const stateRef = commercialStateRef(options.atelierId);
  const atelierRef = adminDb.doc(`ateliers/${options.atelierId}`);
  const auditRef = adminDb.collection('auditLogs').doc();
  await adminDb.runTransaction(async (transaction) => {
    const [atelierSnapshot, stateSnapshot] = await Promise.all([transaction.get(atelierRef), transaction.get(stateRef)]);
    if (!atelierSnapshot.exists) throw new HttpsError('not-found', 'O ateliê não foi encontrado.');
    if (atelierSnapshot.data()?.demoWorkspace === true && options.nextState.subscriptionStatus !== 'demo' && options.action !== 'platform.demo_ended') {
      throw new HttpsError('failed-precondition', 'A demonstração só pode ser encerrada pela ação específica de encerramento.');
    }
    const current = readStateOrPending(stateSnapshot.exists ? stateSnapshot.data() : undefined, isFunctionsEmulator());
    if (JSON.stringify(current) !== JSON.stringify(options.before)) throw new HttpsError('aborted', 'O estado comercial mudou. Atualize a página e tente novamente.');
    transaction.set(stateRef, options.nextState);
    transaction.create(auditRef, {
      actorId: options.actorId,
      atelierId: options.atelierId,
      action: options.action,
      entity: 'tenant_commercial_state',
      entityId: options.atelierId,
      before: options.before,
      after: options.nextState,
      reason: options.reason,
      timestamp: FieldValue.serverTimestamp(),
    });
  });
}

export const updatePlatformTenantCommercialState = onCall(async (call) => {
  const actor = await requireAdminCall(call);
  const data = (call.data ?? {}) as Record<string, unknown>;
  const operation = typeof data.operation === 'string' ? data.operation : '';
  const atelierId = requireAtelierId(data.atelierId);
  const reason = requireReason(data.reason);
  const stateRef = commercialStateRef(atelierId);
  const existingSnapshot = await stateRef.get();
  const allowTestOnly = isFunctionsEmulator();
  const previous = readStateOrPending(existingSnapshot.exists ? existingSnapshot.data() : undefined, allowTestOnly);
  let nextState: TenantCommercialState;
  let action: string;

  if (operation === 'assign_plan') {
    requireExactKeys(data, ['operation', 'atelierId', 'planId', 'subscriptionStatus', 'reason']);
    if (!isPlanId(data.planId) || !getPlanDefinition(data.planId)) throw new HttpsError('invalid-argument', 'Escolha um plano do catálogo local.');
    if (typeof data.subscriptionStatus !== 'string' || !assignableStatuses.has(data.subscriptionStatus as SubscriptionStatus)) {
      throw new HttpsError('invalid-argument', 'Escolha um status comercial permitido. Trial e demo têm operações próprias.');
    }
    nextState = makeState(data.planId, data.subscriptionStatus as SubscriptionStatus, previous);
    action = 'platform.commercial.plan_assigned';
  } else if (operation === 'set_status') {
    requireExactKeys(data, ['operation', 'atelierId', 'subscriptionStatus', 'reason']);
    if (!previous) throw new HttpsError('failed-precondition', 'Atribua um plano antes de alterar o status comercial.');
    if (typeof data.subscriptionStatus !== 'string' || !assignableStatuses.has(data.subscriptionStatus as SubscriptionStatus)) {
      throw new HttpsError('invalid-argument', 'Trial e demo devem ser iniciados ou encerrados pelas ações próprias.');
    }
    nextState = makeState(previous.planId, data.subscriptionStatus as SubscriptionStatus, previous);
    action = 'platform.commercial.status_changed';
  } else if (operation === 'start_trial') {
    requireExactKeys(data, ['operation', 'atelierId', 'reason']);
    const atelier = await adminDb.doc(`ateliers/${atelierId}`).get();
    if (!atelier.exists) throw new HttpsError('not-found', 'O ateliê não foi encontrado.');
    if (atelier.data()?.demoWorkspace === true) throw new HttpsError('failed-precondition', 'Demonstrações não são trials comerciais.');
    if (previous?.subscriptionStatus === 'trial' || previous?.trialUntil) throw new HttpsError('failed-precondition', 'O trial já foi concedido anteriormente.');
    const now = Timestamp.now();
    const trialUntil = new Date(now.toMillis() + PRICING_TERMS.trialDays * 24 * 60 * 60 * 1000).toISOString();
    nextState = makeState('premium', 'trial', previous, trialUntil);
    action = 'platform.commercial.trial_started';
  } else if (operation === 'set_entitlement_override' || operation === 'clear_entitlement_override') {
    requireExactKeys(data, operation === 'set_entitlement_override'
      ? ['operation', 'atelierId', 'featureKey', 'enabled', 'reason']
      : ['operation', 'atelierId', 'featureKey', 'reason']);
    if (!previous) throw new HttpsError('failed-precondition', 'Atribua um plano antes de gerenciar overrides.');
    const featureKey = typeof data.featureKey === 'string' ? data.featureKey : '';
    if (!featureKey || !getFeatureDefinition(featureKey, allowTestOnly)) throw new HttpsError('invalid-argument', 'A feature não possui política comercial aprovada.');
    const overrides = { ...(previous.entitlementOverrides ?? {}) };
    if (operation === 'set_entitlement_override') {
      if (typeof data.enabled !== 'boolean') throw new HttpsError('invalid-argument', 'Informe se o override libera ou bloqueia o recurso.');
      overrides[featureKey] = data.enabled;
    } else delete overrides[featureKey];
    nextState = { ...previous, entitlementOverrides: overrides };
    action = operation === 'set_entitlement_override' ? 'platform.commercial.entitlement_override_set' : 'platform.commercial.entitlement_override_cleared';
  } else if (operation === 'set_limit_override' || operation === 'clear_limit_override') {
    requireExactKeys(data, operation === 'set_limit_override'
      ? ['operation', 'atelierId', 'limitKey', 'limit', 'reason']
      : ['operation', 'atelierId', 'limitKey', 'reason']);
    if (!previous) throw new HttpsError('failed-precondition', 'Atribua um plano antes de gerenciar overrides.');
    const limitKey = typeof data.limitKey === 'string' ? data.limitKey : '';
    if (!limitKey || !getLimitDefinition(limitKey, allowTestOnly)) throw new HttpsError('invalid-argument', 'A cota não possui política aprovada.');
    const overrides = { ...(previous.limitOverrides ?? {}) };
    if (operation === 'set_limit_override') {
      const value = data.limit;
      if (value !== null && (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)) {
        throw new HttpsError('invalid-argument', 'Use zero, um inteiro positivo ou null explícito.');
      }
      overrides[limitKey] = value as number | null;
    } else delete overrides[limitKey];
    nextState = { ...previous, limitOverrides: overrides };
    action = operation === 'set_limit_override' ? 'platform.commercial.limit_override_set' : 'platform.commercial.limit_override_cleared';
  } else {
    throw new HttpsError('invalid-argument', 'Operação de estado comercial desconhecida.');
  }

  try { nextState = validateCommercialState(nextState, allowTestOnly); }
  catch (error) { throw new HttpsError('invalid-argument', error instanceof Error ? error.message : 'Estado comercial inválido.'); }
  await commitCommercialChange({ atelierId, actorId: actor.uid, reason, action, nextState, before: previous });
  return { atelierId, state: nextState };
});

export const createPlatformDemoTenant = onCall(async (call) => {
  const actor = await requireAdminCall(call);
  const data = (call.data ?? {}) as Record<string, unknown>;
  requireExactKeys(data, ['displayName', 'reason']);
  const reason = requireReason(data.reason);
  const displayName = typeof data.displayName === 'string' ? data.displayName.trim() : '';
  if (displayName.length < 3 || displayName.length > 100) throw new HttpsError('invalid-argument', 'Informe um nome de demonstração entre 3 e 100 caracteres.');

  const atelierRef = adminDb.collection('ateliers').doc();
  const atelierId = atelierRef.id;
  const slug = `demo-${atelierId.slice(0, 8).toLowerCase()}`;
  const accountEmail = `demo-${atelierId.slice(0, 8).toLowerCase()}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  let authUid: string;
  try {
    const account = await adminAuth.createUser({ email: accountEmail, password, displayName: `${displayName} — Demonstração`, emailVerified: true, disabled: false });
    authUid = account.uid;
  } catch {
    throw new HttpsError('internal', 'Não foi possível criar o acesso isolado da demonstração.');
  }

  const now = Timestamp.now();
  const stateRef = commercialStateRef(atelierId);
  const configRef = commercialConfigRef(atelierId);
  const auditRef = adminDb.collection('auditLogs').doc();
  const fakeClientId = 'demo-client';
  const fakeEmail = `cliente-${atelierId.slice(0, 8)}@example.invalid`;
  const batch = adminDb.batch();
  batch.set(atelierRef, {
    id: atelierId,
    name: displayName,
    ownerId: authUid,
    active: true,
    demoWorkspace: true,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(adminDb.doc(`users/${authUid}`), {
    id: authUid,
    name: `${displayName} — Demonstração`,
    email: accountEmail,
    accountType: 'atelier_member',
    atelierId,
    role: 'owner',
    permissions: [],
    active: true,
    demoAccount: true,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(adminDb.doc(`ateliers/${atelierId}/members/${authUid}`), {
    userId: authUid,
    role: 'owner',
    permissions: [],
    active: true,
    createdAt: now,
  });
  batch.set(stateRef, {
    planId: 'premium',
    subscriptionStatus: 'demo',
    trialUntil: null,
    entitlementOverrides: {},
    limitOverrides: {},
  });
  batch.set(configRef, { featureConfig: {}, createdAt: now });
  batch.set(adminDb.doc(`publicAteliers/${atelierId}`), {
    name: displayName,
    slug,
    tagline: 'Ambiente fictício para conhecer os fluxos já implementados no Cosmaker OS.',
    brandColor: '#6d28d9',
    published: true,
    quoteRequestsEnabled: false,
    demoWorkspace: true,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(adminDb.doc(`publicAtelierSlugs/${slug}`), { slug, atelierId, createdAt: now, updatedAt: now });
  batch.set(adminDb.doc(`ateliers/${atelierId}/clients/${fakeClientId}`), {
    id: fakeClientId,
    name: 'Marina Demonstração',
    email: fakeEmail,
    phone: null,
    totalSpent: 0,
    orderCount: 0,
    demoFixture: true,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(adminDb.doc(`ateliers/${atelierId}/quoteRequests/demo-request`), {
    name: 'Marina Demonstração',
    email: fakeEmail,
    character: 'Mikasa Ackerman',
    franchise: 'Obra fictícia para demonstração',
    category: 'full_cosplay',
    description: 'Solicitação sintética para demonstrar o fluxo de orçamento.',
    desiredDeliveryDate: '2027-12-01',
    urgency: 'normal',
    status: 'new',
    demoFixture: true,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(adminDb.doc(`ateliers/${atelierId}/measurementProfiles/demo-profile`), {
    clientId: fakeClientId,
    name: 'Ficha de demonstração',
    active: true,
    demoFixture: true,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(adminDb.doc(`ateliers/${atelierId}/measurementProfiles/demo-profile/measurements/chest`), {
    type: 'circumference', label: 'Tórax', value: 88, unit: 'cm', notes: 'Dado fictício', createdAt: now, updatedAt: now,
  });
  batch.set(adminDb.doc(`ateliers/${atelierId}/measurementProfiles/demo-profile/measurements/waist`), {
    type: 'circumference', label: 'Cintura', value: 68, unit: 'cm', notes: 'Dado fictício', createdAt: now, updatedAt: now,
  });
  batch.set(adminDb.doc(`ateliers/${atelierId}/quotes/demo-quote`), {
    atelierId,
    requestId: 'demo-request',
    clientId: fakeClientId,
    email: fakeEmail,
    status: 'draft',
    materialsCost: 850,
    laborCost: 1050,
    otherCost: 100,
    urgencyFee: 0,
    shipping: 0,
    discount: 0,
    subtotal: 2000,
    total: 2000,
    depositPercentage: 30,
    depositAmount: 600,
    demoFixture: true,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(adminDb.doc(`ateliers/${atelierId}/quotes/demo-quote/items/material`), { description: 'Materiais sintéticos', category: 'material', quantity: 1, unitPrice: 850, total: 850, createdAt: now });
  batch.set(adminDb.doc(`ateliers/${atelierId}/quotes/demo-quote/items/labor`), { description: 'Confecção fictícia', category: 'labor', quantity: 1, unitPrice: 1050, total: 1050, createdAt: now });
  batch.set(adminDb.doc(`ateliers/${atelierId}/orders/demo-order`), {
    id: 'demo-order', atelierId, clientId: fakeClientId, clientName: 'Marina Demonstração',
    status: 'confirmed', progress: 25, amountPaid: 600, amountRemaining: 1400,
    approvedQuoteSnapshot: { total: 2000, depositAmount: 600 },
    demoFixture: true, createdAt: now, updatedAt: now,
  });
  batch.set(adminDb.doc(`ateliers/${atelierId}/orders/demo-order/items/material`), { description: 'Materiais sintéticos', quantity: 1, unitPrice: 850, total: 850, createdAt: now });
  batch.set(adminDb.doc(`ateliers/${atelierId}/orders/demo-order/productionStages/modeling`), {
    id: 'modeling', label: 'Modelagem', status: 'in_progress', progress: 25, orderId: 'demo-order', atelierId, demoFixture: true, createdAt: now, updatedAt: now,
  });
  batch.set(auditRef, {
    actorId: actor.uid,
    atelierId,
    action: 'platform.commercial.demo_created',
    entity: 'tenant_commercial_state',
    entityId: atelierId,
    before: null,
    after: { planId: 'premium', subscriptionStatus: 'demo', slug },
    reason,
    timestamp: FieldValue.serverTimestamp(),
  });

  try { await batch.commit(); }
  catch {
    await adminAuth.deleteUser(authUid).catch(() => undefined);
    throw new HttpsError('internal', 'Não foi possível salvar os dados sintéticos da demonstração.');
  }

  return {
    atelierId,
    slug,
    publicUrlPath: `/${slug}`,
    displayName,
    demoEmail: accountEmail,
    oneTimePassword: password,
    subscriptionStatus: 'demo',
    planId: 'premium',
  };
});

export const endPlatformDemoTenant = onCall(async (call) => {
  const actor = await requireAdminCall(call);
  const data = (call.data ?? {}) as Record<string, unknown>;
  requireExactKeys(data, ['atelierId', 'reason']);
  const atelierId = requireAtelierId(data.atelierId);
  const reason = requireReason(data.reason);
  const atelierRef = adminDb.doc(`ateliers/${atelierId}`);
  const stateRef = commercialStateRef(atelierId);
  const publicRef = adminDb.doc(`publicAteliers/${atelierId}`);
  const auditRef = adminDb.collection('auditLogs').doc();
  let ownerId = '';

  await adminDb.runTransaction(async (transaction) => {
    const [atelierSnapshot, stateSnapshot, publicSnapshot] = await Promise.all([
      transaction.get(atelierRef), transaction.get(stateRef), transaction.get(publicRef),
    ]);
    if (!atelierSnapshot.exists || atelierSnapshot.data()?.demoWorkspace !== true) throw new HttpsError('failed-precondition', 'Este ateliê não é uma demonstração gerenciada pelo Platform Owner.');
    if (!stateSnapshot.exists) throw new HttpsError('failed-precondition', 'O estado comercial da demonstração não existe.');
    const previous = readStateOrPending(stateSnapshot.data(), isFunctionsEmulator());
    if (!previous || previous.subscriptionStatus !== 'demo') throw new HttpsError('failed-precondition', 'A demonstração já foi encerrada ou não está atribuída ao modo demo.');
    ownerId = typeof atelierSnapshot.data()?.ownerId === 'string' ? atelierSnapshot.data()!.ownerId : '';
    const next = { ...previous, subscriptionStatus: 'cancelled' as const, trialUntil: null };
    transaction.set(stateRef, next);
    if (ownerId) transaction.set(adminDb.doc(`ateliers/${atelierId}/members/${ownerId}`), { active: false, demoEndedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (ownerId) transaction.set(adminDb.doc(`users/${ownerId}`), { active: false, demoEndedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (publicSnapshot.exists) transaction.update(publicRef, { published: false, quoteRequestsEnabled: false, updatedAt: FieldValue.serverTimestamp() });
    transaction.create(auditRef, {
      actorId: actor.uid,
      atelierId,
      action: 'platform.commercial.demo_ended',
      entity: 'tenant_commercial_state',
      entityId: atelierId,
      before: previous,
      after: next,
      reason,
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  let accountDisabled = true;
  if (ownerId) {
    try {
      await adminAuth.updateUser(ownerId, { disabled: true });
      await adminAuth.revokeRefreshTokens(ownerId);
    } catch { accountDisabled = false; }
  }
  return { atelierId, subscriptionStatus: 'cancelled', operationallySuspended: false, accountDisabled };
});
