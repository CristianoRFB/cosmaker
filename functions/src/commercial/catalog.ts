import type { PlanDefinition, PlanId } from './types';

/** Vertical-local pricing. Feature and quantitative policies remain unset until approved. */
export const PLAN_CATALOG: readonly PlanDefinition[] = [
  { id: 'essencial', name: 'Essencial', rank: 1, features: [], limits: {}, monthlyPriceCents: 5990, annualPriceCents: 59900 },
  { id: 'pro', name: 'Pro', rank: 2, features: [], limits: {}, monthlyPriceCents: 11990, annualPriceCents: 119900, recommended: true },
  { id: 'premium', name: 'Premium', rank: 3, features: [], limits: {}, monthlyPriceCents: 19990, annualPriceCents: 199900 },
];

export const SETUP_FEE_CENTS = 29900;
export const TRIAL_DURATION_DAYS = 14;

export const TEST_ONLY_FEATURE_KEY = 'test_only.operation_probe';
export const TEST_ONLY_LIMIT_KEY = 'test_only.operation_count';

export interface FeatureDefinition {
  key: string;
  name: string;
  implemented: boolean;
  testOnly: boolean;
}

export interface LimitDefinition {
  key: string;
  name: string;
  unit: string;
  testOnly: boolean;
}

/** These probe policies exist only to prove the enforcement mechanics in Emulator. */
export const TEST_ONLY_FEATURES: readonly FeatureDefinition[] = [
  { key: TEST_ONLY_FEATURE_KEY, name: 'Operação de validação comercial', implemented: true, testOnly: true },
];

export const TEST_ONLY_LIMITS: readonly LimitDefinition[] = [
  { key: TEST_ONLY_LIMIT_KEY, name: 'Operações de validação comercial', unit: 'operações', testOnly: true },
];

export const PRICING_TERMS = {
  setupFeeCents: SETUP_FEE_CENTS,
  trialDays: TRIAL_DURATION_DAYS,
  trialPlanId: 'premium' as PlanId,
  noCardRequired: true,
  automaticBilling: false,
  addOns: [] as const,
};

export function getPlanDefinition(planId: string) {
  return PLAN_CATALOG.find((plan) => plan.id === planId);
}

export function isPlanId(planId: unknown): planId is PlanId {
  return typeof planId === 'string' && PLAN_CATALOG.some((plan) => plan.id === planId);
}

export function getFeatureDefinition(featureKey: string, allowTestOnly = false) {
  return TEST_ONLY_FEATURES.find((feature) => feature.key === featureKey && (!feature.testOnly || allowTestOnly));
}

export function getLimitDefinition(limitKey: string, allowTestOnly = false) {
  return TEST_ONLY_LIMITS.find((limit) => limit.key === limitKey && (!limit.testOnly || allowTestOnly));
}

export function assertPlanCatalogInvariants(catalog: readonly PlanDefinition[] = PLAN_CATALOG) {
  if (!Array.isArray(catalog) || catalog.length === 0) throw new Error('Catálogo de planos inválido.');
  const plans = catalog as readonly PlanDefinition[];
  const ids = new Set<string>();
  const ranks = new Set<number>();
  const validKey = (key: unknown): key is string => typeof key === 'string' && /^[a-z][a-z0-9_]*(?:[.:][a-z][a-z0-9_-]*)*$/.test(key);
  for (const plan of plans) {
    if (!plan || typeof plan !== 'object' || !isPlanId(plan.id)) throw new Error('ID de plano desconhecido.');
    if (ids.has(plan.id)) throw new Error(`ID duplicado no catálogo: ${plan.id}`);
    ids.add(plan.id);
    const approvedPlan = getPlanDefinition(plan.id)!;
    if (typeof plan.name !== 'string' || plan.name !== approvedPlan.name) throw new Error(`Nome inválido: ${plan.id}`);
    if (!Number.isSafeInteger(plan.rank) || plan.rank !== approvedPlan.rank || ranks.has(plan.rank)) throw new Error(`Rank inválido: ${plan.id}`);
    ranks.add(plan.rank);
    if (!Number.isSafeInteger(plan.monthlyPriceCents) || plan.monthlyPriceCents < 0) throw new Error(`Preço mensal inválido: ${plan.id}`);
    if (!Number.isSafeInteger(plan.annualPriceCents) || plan.annualPriceCents < 0) throw new Error(`Preço anual inválido: ${plan.id}`);
    if (plan.recommended !== undefined && typeof plan.recommended !== 'boolean') throw new Error(`Destaque inválido: ${plan.id}`);
    if (!Array.isArray(plan.features) || !plan.features.every(validKey) || new Set(plan.features).size !== plan.features.length) {
      throw new Error(`Recursos inválidos: ${plan.id}`);
    }
    if (!plan.limits || typeof plan.limits !== 'object' || Array.isArray(plan.limits)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(plan.limits))) throw new Error(`Limites inválidos: ${plan.id}`);
    for (const [key, limit] of Object.entries(plan.limits)) {
      if (!validKey(key) || (limit !== null && (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit < 0))) throw new Error(`Limite inválido: ${plan.id}/${key}`);
    }
  }
  const byRank = [...plans].sort((left, right) => left.rank - right.rank);
  for (let index = 1; index < byRank.length; index += 1) {
    const previous = byRank[index - 1];
    const current = byRank[index];
    if (!previous.features.every((feature) => current.features.includes(feature))) {
      throw new Error(`${current.id} deve herdar os recursos explicitamente definidos em ${previous.id}.`);
    }
    for (const [key, previousLimit] of Object.entries(previous.limits)) {
      if (!(key in current.limits)) throw new Error(`${current.id} precisa declarar a chave ${key} herdada de ${previous.id}.`);
      const currentLimit = current.limits[key];
      if ((previousLimit === null && currentLimit !== null)
        || (previousLimit !== null && currentLimit !== null && currentLimit < previousLimit)) {
        throw new Error(`${current.id} não pode reduzir o limite ${key} de ${previous.id}.`);
      }
    }
  }
}
