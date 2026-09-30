import { describe, expect, it } from 'vitest';
import { assertAtelierStatusTransition, hasPlatformAdminAccess } from '../../functions/src/platform/access-policy';

describe('platform admin authorization policy', () => {
  it('accepts a verified account with the platform custom claim and an active profile', () => {
    expect(hasPlatformAdminAccess({ email_verified: true, platformAdmin: true }, { accountType: 'platform_admin', active: true })).toBe(true);
    expect(hasPlatformAdminAccess({ email_verified: true, platformAdmin: true }, undefined)).toBe(false);
  });

  it('accepts an active platform profile only when email is verified', () => {
    expect(hasPlatformAdminAccess({ email_verified: true }, { accountType: 'platform_admin', active: true })).toBe(true);
    expect(hasPlatformAdminAccess({ email_verified: false }, { accountType: 'platform_admin', active: true })).toBe(false);
  });

  it('rejects ordinary, inactive, and client profiles', () => {
    expect(hasPlatformAdminAccess({ email_verified: true }, { accountType: 'client', active: true })).toBe(false);
    expect(hasPlatformAdminAccess({ email_verified: true }, { accountType: 'platform_admin', active: false })).toBe(false);
    expect(hasPlatformAdminAccess({ email_verified: true, platformAdmin: true }, { accountType: 'platform_admin', active: false })).toBe(false);
    expect(hasPlatformAdminAccess({ platformAdmin: true }, { accountType: 'platform_admin', active: true })).toBe(false);
  });

  it('permits only real status transitions', () => {
    expect(assertAtelierStatusTransition(true, false)).toBe(true);
    expect(assertAtelierStatusTransition(false, true)).toBe(true);
    expect(assertAtelierStatusTransition(true, true)).toBe(false);
    expect(assertAtelierStatusTransition(false, false)).toBe(false);
  });
});
