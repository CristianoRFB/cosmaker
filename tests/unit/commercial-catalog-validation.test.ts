import { describe, expect, it } from 'vitest';
import { assertPlanCatalogInvariants, PLAN_CATALOG } from '@/lib/commercial/catalog';
import type { PlanDefinition } from '@/types/commercial';

function withFirstPlan(change: Record<string, unknown>) {
  return PLAN_CATALOG.map((plan, index) => index === 0 ? { ...plan, ...change } : { ...plan }) as PlanDefinition[];
}

describe('commercial catalog runtime contract', () => {
  it.each([
    { id: 'unknown' }, { id: 42 }, { name: null }, { name: '' }, { name: 'Other name' },
    { rank: 0 }, { rank: 1.5 }, { rank: 2 }, { rank: Infinity },
    { features: null }, { features: 'orders:read' }, { features: ['orders:read', 'orders:read'] },
    { features: [42] }, { features: ['invalid key'] },
    { limits: null }, { limits: [] }, { limits: { 'orders.created': -1 } },
    { limits: { 'orders.created': 1.5 } }, { limits: { 'orders.created': Infinity } },
    { limits: { 'orders.created': Number.MAX_SAFE_INTEGER + 1 } }, { limits: { 'orders.created': undefined } },
    { limits: { 'invalid key': 1 } }, { recommended: 'true' },
    { monthlyPriceCents: Number.MAX_SAFE_INTEGER + 1 }, { annualPriceCents: NaN },
  ])('rejects malformed runtime data %j', (change) => {
    expect(() => assertPlanCatalogInvariants(withFirstPlan(change))).toThrow();
  });

  it('requires at least one plan and rejects duplicate stable IDs', () => {
    expect(() => assertPlanCatalogInvariants([])).toThrow(/Catálogo/);
    expect(() => assertPlanCatalogInvariants([PLAN_CATALOG[0], PLAN_CATALOG[0]])).toThrow(/ID duplicado/);
  });

  it('does not replace a lower-plan explicit null ceiling with a finite higher-plan ceiling', () => {
    const catalog = PLAN_CATALOG.map((plan, index) => ({ ...plan, limits: { 'orders.created': index === 0 ? null : 10 } }));
    expect(() => assertPlanCatalogInvariants(catalog)).toThrow(/não pode reduzir o limite/);
  });

  it('accepts zero, positive integers and a higher-plan explicit null without inventing production policies', () => {
    const catalog = PLAN_CATALOG.map((plan, index) => ({
      ...plan,
      features: ['fixture.feature'],
      limits: { 'fixture.count': index === 0 ? 0 : index === 1 ? 7 : null },
    }));
    expect(() => assertPlanCatalogInvariants(catalog)).not.toThrow();
    expect(PLAN_CATALOG.every((plan) => plan.features.length === 0 && Object.keys(plan.limits).length === 0)).toBe(true);
  });
});
