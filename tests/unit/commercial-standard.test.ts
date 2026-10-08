import { describe, expect, it } from 'vitest';
import { assertPlanCatalogInvariants, PLAN_CATALOG, PRICING_TERMS, TEST_ONLY_FEATURE_KEY, TEST_ONLY_LIMIT_KEY } from '@/lib/commercial/catalog';
import { canUse, getLimit, resolveCommercialState, resolveEntitlement, resolveFeatureAvailability, resolveLimit } from '@/lib/commercial/entitlements';
import type { CommercialTenantSnapshot, PlanDefinition, TenantCommercialState } from '@/types/commercial';

function tenant(state: Partial<TenantCommercialState> = {}, extra: Partial<CommercialTenantSnapshot> = {}): CommercialTenantSnapshot {
  return {
    commercialState: { planId: 'premium', subscriptionStatus: 'active', ...state },
    featureConfig: { [TEST_ONLY_FEATURE_KEY]: true },
    ...extra,
  };
}

describe('Global Standard v01 local catalog', () => {
  it('keeps exact Cosmaker price metadata separate from use rights', () => {
    expect(PLAN_CATALOG.map(({ id, name, rank, monthlyPriceCents, annualPriceCents, recommended, features, limits }) => ({ id, name, rank, monthlyPriceCents, annualPriceCents, recommended: recommended ?? false, features, limits }))).toEqual([
      { id: 'essencial', name: 'Essencial', rank: 1, monthlyPriceCents: 5990, annualPriceCents: 59900, recommended: false, features: [], limits: {} },
      { id: 'pro', name: 'Pro', rank: 2, monthlyPriceCents: 11990, annualPriceCents: 119900, recommended: true, features: [], limits: {} },
      { id: 'premium', name: 'Premium', rank: 3, monthlyPriceCents: 19990, annualPriceCents: 199900, recommended: false, features: [], limits: {} },
    ]);
    expect(PRICING_TERMS).toMatchObject({ setupFeeCents: 29900, trialDays: 14, trialPlanId: 'premium', noCardRequired: true, automaticBilling: false, addOns: [] });
    expect(assertPlanCatalogInvariants()).toBeUndefined();
  });

  it('requires plan inheritance when an approved policy is eventually added', () => {
    const base: PlanDefinition[] = PLAN_CATALOG.map((plan) => ({ ...plan, features: [], limits: {} }));
    const featureCatalog: PlanDefinition[] = base.map((plan, index) => ({ ...plan, features: index === 0 ? ['orders:read'] : index === 1 ? [] : ['orders:read'] }));
    expect(() => assertPlanCatalogInvariants(featureCatalog)).toThrow(/herdar os recursos/);
    const limitCatalog: PlanDefinition[] = base.map((plan, index) => ({ ...plan, limits: index === 0 ? { 'orders.created': 10 } : index === 1 ? { 'orders.created': 5 } : { 'orders.created': null } }));
    expect(() => assertPlanCatalogInvariants(limitCatalog)).toThrow(/não pode reduzir o limite/);
    const incompleteLimits: PlanDefinition[] = base.map((plan, index) => ({
      ...plan,
      limits: index === 0 ? { 'orders.created': 1 } : {} as Record<string, number | null>,
    }));
    expect(() => assertPlanCatalogInvariants(incompleteLimits)).toThrow(/precisa declarar a chave/);
  });
});

describe('entitlements and limits', () => {
  it('denies unknown/unconfigured commercial features without changing core modules', () => {
    expect(canUse(tenant(), 'reports.advanced')).toBe(false);
    expect(resolveEntitlement({ commercialState: { planId: 'pro', subscriptionStatus: 'active' } }, 'unknown')).toMatchObject({ allowed: false, reason: 'unknown_feature' });
  });

  it('requires entitlement, feature configuration, and implementation together', () => {
    const withOverride = tenant({ entitlementOverrides: { [TEST_ONLY_FEATURE_KEY]: true } });
    expect(resolveFeatureAvailability(withOverride, TEST_ONLY_FEATURE_KEY, { allowTestOnly: true })).toMatchObject({ allowed: true, configured: true, implemented: true, available: true });
    expect(resolveFeatureAvailability({ ...withOverride, featureConfig: {} }, TEST_ONLY_FEATURE_KEY, { allowTestOnly: true })).toMatchObject({ allowed: true, configured: false, available: false, reason: 'not_configured' });
    expect(resolveFeatureAvailability(tenant({ entitlementOverrides: { [TEST_ONLY_FEATURE_KEY]: false } }), TEST_ONLY_FEATURE_KEY, { allowTestOnly: true }).available).toBe(false);
    expect(resolveFeatureAvailability(withOverride, TEST_ONLY_FEATURE_KEY).available).toBe(false);
  });

  it('applies boolean overrides after the base plan and confines fixture entitlements to Emulator', () => {
    expect(canUse(tenant({ entitlementOverrides: { [TEST_ONLY_FEATURE_KEY]: true } }), TEST_ONLY_FEATURE_KEY, { allowTestOnly: true })).toBe(true);
    expect(canUse(tenant({ entitlementOverrides: { [TEST_ONLY_FEATURE_KEY]: false } }), TEST_ONLY_FEATURE_KEY, { allowTestOnly: true })).toBe(false);
    expect(canUse(tenant({ entitlementOverrides: { [TEST_ONLY_FEATURE_KEY]: true } }), TEST_ONLY_FEATURE_KEY)).toBe(false);
  });

  it('requires a future explicit trialUntil and checks its exact UTC boundary', () => {
    const trial = tenant({ subscriptionStatus: 'trial', trialUntil: '2026-10-08T12:00:00.000Z', entitlementOverrides: { [TEST_ONLY_FEATURE_KEY]: true } });
    expect(canUse(trial, TEST_ONLY_FEATURE_KEY, { allowTestOnly: true, now: new Date('2026-10-08T11:59:59.999Z') })).toBe(true);
    expect(canUse(trial, TEST_ONLY_FEATURE_KEY, { allowTestOnly: true, now: new Date('2026-10-08T12:00:00.000Z') })).toBe(false);
    expect(resolveEntitlement(trial, TEST_ONLY_FEATURE_KEY, { allowTestOnly: true, now: new Date('2026-10-08T12:00:00.000Z') })).toMatchObject({ allowed: false, reason: 'expired' });
    expect(resolveEntitlement(trial, TEST_ONLY_FEATURE_KEY, { allowTestOnly: true, now: new Date('2026-10-08T12:00:00.001Z') })).toMatchObject({ allowed: false, reason: 'expired' });
    expect(canUse(tenant({ subscriptionStatus: 'trial', entitlementOverrides: { [TEST_ONLY_FEATURE_KEY]: true } }), TEST_ONLY_FEATURE_KEY, { allowTestOnly: true })).toBe(false);
  });

  it('treats demo without an explicit end as open-ended and respects an explicit end when present', () => {
    expect(canUse(tenant({ subscriptionStatus: 'demo', entitlementOverrides: { [TEST_ONLY_FEATURE_KEY]: true } }), TEST_ONLY_FEATURE_KEY, { allowTestOnly: true })).toBe(true);
    const demo = tenant({ subscriptionStatus: 'demo', trialUntil: '2026-10-08T12:00:00.000Z', entitlementOverrides: { [TEST_ONLY_FEATURE_KEY]: true } });
    expect(canUse(demo, TEST_ONLY_FEATURE_KEY, { allowTestOnly: true, now: new Date('2026-10-08T12:00:00.000Z') })).toBe(false);
  });

  it('restricts past_due, suspended, cancelled, and unassigned commercial operations', () => {
    for (const subscriptionStatus of ['past_due', 'suspended', 'cancelled'] as const) {
      expect(canUse(tenant({ subscriptionStatus, entitlementOverrides: { [TEST_ONLY_FEATURE_KEY]: true } }), TEST_ONLY_FEATURE_KEY, { allowTestOnly: true })).toBe(false);
    }
    expect(resolveCommercialState({})).toEqual({ assignment: 'pending_assignment' });
    expect(canUse({}, TEST_ONLY_FEATURE_KEY, { allowTestOnly: true })).toBe(false);
  });

  it('distinguishes missing limit policy, explicit null, zero, positive values, and overrides', () => {
    const absent = tenant();
    expect(resolveLimit(absent, TEST_ONLY_LIMIT_KEY, true)).toMatchObject({ status: 'not_configured' });
    expect(() => getLimit(absent, TEST_ONLY_LIMIT_KEY, true)).toThrow(/sem política configurada/);
    expect(getLimit(tenant({ limitOverrides: { [TEST_ONLY_LIMIT_KEY]: null } }), TEST_ONLY_LIMIT_KEY, true)).toBeNull();
    expect(getLimit(tenant({ limitOverrides: { [TEST_ONLY_LIMIT_KEY]: 0 } }), TEST_ONLY_LIMIT_KEY, true)).toBe(0);
    expect(getLimit(tenant({ limitOverrides: { [TEST_ONLY_LIMIT_KEY]: 7 } }), TEST_ONLY_LIMIT_KEY, true)).toBe(7);
    expect(resolveLimit(absent, 'users.active', true)).toMatchObject({ status: 'unknown' });
  });
});
