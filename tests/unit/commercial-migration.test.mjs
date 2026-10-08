import { describe, expect, it } from 'vitest';
import { validateCommercialState } from '../../functions/src/commercial/entitlements.ts';
import { resolveLegacyCommercialState } from '../../scripts/migrate-commercial-state.mjs';

const candidate = (change = {}) => ({ planId: 'premium', subscriptionStatus: 'trial', trialUntil: '2026-10-08T12:00:00.000Z', ...change });
const resolveState = (data) => resolveLegacyCommercialState(data, validateCommercialState);

describe('commercial migration contract', () => {
  it.each([
    '2026-10-08', '2026-10-08T12:00:00', '10/08/2026', 'October 8, 2026',
    '2026-02-30T12:00:00Z', '2026-13-08T12:00:00Z', 'not-a-date', 1791460800000,
  ])('leaves invalid or timezone-free dates pending: %j', (trialUntil) => {
    expect(resolveState(candidate({ trialUntil }))).toBeNull();
  });

  it('normalizes a valid explicit offset into UTC while retaining the original trial deadline', () => {
    expect(resolveState(candidate({ trialUntil: '2026-10-08T09:00:00-03:00' }))).toMatchObject({ trialUntil: '2026-10-08T12:00:00.000Z' });
    expect(resolveState(candidate({ subscriptionStatus: 'active' }))).toMatchObject({ trialUntil: '2026-10-08T12:00:00.000Z' });
  });

  it('requires Premium and an explicit deadline for trial', () => {
    expect(resolveState(candidate({ planId: 'pro' }))).toBeNull();
    expect(resolveState(candidate({ trialUntil: null }))).toBeNull();
    expect(resolveState(candidate({ trialUntil: undefined }))).toBeNull();
  });

  it('requires an existing true demo marker and Premium for demo migration', () => {
    expect(resolveState(candidate({ subscriptionStatus: 'demo', demoWorkspace: false }))).toBeNull();
    expect(resolveState(candidate({ subscriptionStatus: 'demo' }))).toBeNull();
    expect(resolveState(candidate({ subscriptionStatus: 'demo', demoWorkspace: true, planId: 'essencial' }))).toBeNull();
    expect(resolveState(candidate({ subscriptionStatus: 'demo', demoWorkspace: true, trialUntil: null }))).toMatchObject({ subscriptionStatus: 'demo', planId: 'premium', trialUntil: null });
  });

  it('reuses the shared state validator and never infers a plan from operational status', () => {
    expect(resolveState({ plan: 'essencial', subscriptionStatus: 'active' })).toMatchObject({ planId: 'essencial', subscriptionStatus: 'active', entitlementOverrides: {}, limitOverrides: {} });
    expect(resolveState({ planId: 'unknown', subscriptionStatus: 'active' })).toBeNull();
    expect(resolveState({ active: true, status: 'active' })).toBeNull();
    expect(resolveState(candidate({ subscriptionStatus: 'unknown' }))).toBeNull();
  });
});
