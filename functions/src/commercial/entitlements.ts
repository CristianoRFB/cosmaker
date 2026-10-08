import { z } from 'zod';
import { getFeatureDefinition, getLimitDefinition, getPlanDefinition, isPlanId } from './catalog';
import { SUBSCRIPTION_STATUSES, type CommercialStateResolution, type CommercialTenantSnapshot, type LimitResolution, type SubscriptionStatus, type TenantCommercialState } from './types';

const commercialStateSchema = z.object({
  planId: z.enum(['essencial', 'pro', 'premium']),
  subscriptionStatus: z.enum(SUBSCRIPTION_STATUSES),
  trialUntil: z.string().datetime({ offset: true }).nullable().optional(),
  entitlementOverrides: z.record(z.string(), z.boolean()).optional(),
  limitOverrides: z.record(z.string(), z.union([z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), z.null()])).optional(),
}).strict();

export type CommercialEntitlementReason =
  | 'allowed'
  | 'pending_assignment'
  | 'invalid_state'
  | 'unknown_feature'
  | 'not_implemented'
  | 'test_only'
  | 'expired'
  | 'status_restricted'
  | 'not_entitled'
  | 'not_configured';

export interface EntitlementResolution {
  allowed: boolean;
  reason: CommercialEntitlementReason;
  source?: 'plan' | 'override';
}

export interface FeatureAvailability extends EntitlementResolution {
  available: boolean;
  implemented: boolean;
  configured: boolean;
}

export interface EntitlementContext {
  now?: Date;
  allowTestOnly?: boolean;
}

export function resolveCommercialState(tenant: CommercialTenantSnapshot | null | undefined): CommercialStateResolution {
  if (!tenant || tenant.commercialState === undefined || tenant.commercialState === null) return { assignment: 'pending_assignment' };
  const parsed = commercialStateSchema.safeParse(tenant.commercialState);
  if (!parsed.success) return { assignment: 'invalid_state', error: parsed.error.issues[0]?.message ?? 'Estado comercial inválido.' };
  if (!isPlanId(parsed.data.planId)) return { assignment: 'invalid_state', error: 'Plano desconhecido.' };
  const state = parsed.data as TenantCommercialState;
  for (const featureKey of Object.keys(state.entitlementOverrides ?? {})) {
    if (!getFeatureDefinition(featureKey, true)) return { assignment: 'invalid_state', error: `Entitlement desconhecido: ${featureKey}` };
  }
  for (const limitKey of Object.keys(state.limitOverrides ?? {})) {
    if (!getLimitDefinition(limitKey, true)) return { assignment: 'invalid_state', error: `Limite desconhecido: ${limitKey}` };
  }
  return { assignment: 'assigned', state };
}

function statusAllowsCommercialFeature(state: TenantCommercialState, now: Date) {
  if (state.subscriptionStatus === 'active') return true;
  if (state.subscriptionStatus === 'trial') {
    if (!state.trialUntil) return false;
    const trialUntil = Date.parse(state.trialUntil);
    return Number.isFinite(trialUntil) && now.getTime() < trialUntil;
  }
  if (state.subscriptionStatus === 'demo') {
    if (state.trialUntil === undefined || state.trialUntil === null) return true;
    const demoUntil = Date.parse(state.trialUntil);
    return Number.isFinite(demoUntil) && now.getTime() < demoUntil;
  }
  return false;
}

export function resolveEntitlement(tenant: CommercialTenantSnapshot | null | undefined, featureKey: string, context: EntitlementContext = {}): EntitlementResolution {
  const feature = getFeatureDefinition(featureKey, context.allowTestOnly === true);
  if (!feature) return { allowed: false, reason: 'unknown_feature' };
  if (!feature.implemented) return { allowed: false, reason: 'not_implemented' };
  if (feature.testOnly && context.allowTestOnly !== true) return { allowed: false, reason: 'test_only' };
  const resolution = resolveCommercialState(tenant);
  if (resolution.assignment === 'pending_assignment') return { allowed: false, reason: 'pending_assignment' };
  if (resolution.assignment === 'invalid_state') return { allowed: false, reason: 'invalid_state' };
  const state = resolution.state;
  const now = context.now ?? new Date();
  if (!statusAllowsCommercialFeature(state, now)) {
    const expired = ['trial', 'demo'].includes(state.subscriptionStatus) && Boolean(state.trialUntil) && Date.parse(state.trialUntil!) <= now.getTime();
    return { allowed: false, reason: expired ? 'expired' : 'status_restricted' };
  }
  const override = state.entitlementOverrides?.[featureKey];
  const entitled = typeof override === 'boolean' ? override : getPlanDefinition(state.planId)?.features.includes(featureKey) === true;
  if (!entitled) return { allowed: false, reason: 'not_entitled' };
  return { allowed: true, reason: 'allowed', source: typeof override === 'boolean' ? 'override' : 'plan' };
}

export function canUse(tenant: CommercialTenantSnapshot | null | undefined, featureKey: string, context: EntitlementContext = {}) {
  return resolveEntitlement(tenant, featureKey, context).allowed;
}

export function resolveFeatureAvailability(
  tenant: CommercialTenantSnapshot | null | undefined,
  featureKey: string,
  context: EntitlementContext = {},
): FeatureAvailability {
  const feature = getFeatureDefinition(featureKey, context.allowTestOnly === true);
  const entitlement = resolveEntitlement(tenant, featureKey, context);
  const featureConfig = tenant?.featureConfig;
  const configured = Boolean(feature && featureConfig && typeof featureConfig === 'object' && (featureConfig as Record<string, unknown>)[featureKey] === true);
  const implemented = feature?.implemented === true;
  const available = entitlement.allowed && configured && implemented;
  return {
    ...entitlement,
    available,
    implemented,
    configured,
    reason: !implemented ? entitlement.reason : !configured && entitlement.allowed ? 'not_configured' : entitlement.reason,
  };
}

export function resolveLimit(tenant: CommercialTenantSnapshot | null | undefined, limitKey: string, allowTestOnly = false): LimitResolution {
  const definition = getLimitDefinition(limitKey, allowTestOnly);
  if (!definition) return { status: 'unknown', key: limitKey };
  const resolution = resolveCommercialState(tenant);
  if (resolution.assignment !== 'assigned') return { status: 'not_configured', key: limitKey };
  const state = resolution.state;
  if (Object.prototype.hasOwnProperty.call(state.limitOverrides ?? {}, limitKey)) {
    return { status: 'configured', limit: state.limitOverrides![limitKey], source: 'override' };
  }
  const plan = getPlanDefinition(state.planId);
  if (plan && Object.prototype.hasOwnProperty.call(plan.limits, limitKey)) {
    return { status: 'configured', limit: plan.limits[limitKey], source: 'plan' };
  }
  return { status: 'not_configured', key: limitKey };
}

export class CommercialPolicyError extends Error {
  constructor(readonly code: 'unknown' | 'not-configured', key: string) {
    super(code === 'unknown' ? `Chave comercial desconhecida: ${key}` : `Limite sem política configurada: ${key}`);
    this.name = 'CommercialPolicyError';
  }
}

/** Returns an explicitly configured limit. null means no ceiling; missing policy throws. */
export function getLimit(tenant: CommercialTenantSnapshot | null | undefined, limitKey: string, allowTestOnly = false): number | null {
  const resolution = resolveLimit(tenant, limitKey, allowTestOnly);
  if (resolution.status === 'unknown') throw new CommercialPolicyError('unknown', limitKey);
  if (resolution.status === 'not_configured') throw new CommercialPolicyError('not-configured', limitKey);
  return resolution.limit;
}

export function validateCommercialState(value: unknown, allowTestOnly = false): TenantCommercialState {
  const parsed = commercialStateSchema.parse(value);
  for (const featureKey of Object.keys(parsed.entitlementOverrides ?? {})) {
    if (!getFeatureDefinition(featureKey, allowTestOnly)) throw new Error(`Entitlement não permitido: ${featureKey}`);
  }
  for (const limitKey of Object.keys(parsed.limitOverrides ?? {})) {
    if (!getLimitDefinition(limitKey, allowTestOnly)) throw new Error(`Limite não permitido: ${limitKey}`);
  }
  return parsed as TenantCommercialState;
}

export function validateFeatureConfig(value: unknown, allowTestOnly = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuração de feature inválida.');
  const config = value as Record<string, unknown>;
  for (const [key, enabled] of Object.entries(config)) {
    if (!getFeatureDefinition(key, allowTestOnly) || typeof enabled !== 'boolean') throw new Error(`Configuração de feature não permitida: ${key}`);
  }
  return config as Record<string, boolean>;
}

export function statusAllowsNewCommercialOperation(status: SubscriptionStatus, trialUntil: string | null | undefined, now = new Date()) {
  return statusAllowsCommercialFeature({ planId: 'premium', subscriptionStatus: status, trialUntil }, now);
}
