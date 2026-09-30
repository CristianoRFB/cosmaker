import { describe, expect, it } from 'vitest';
import { canAccessAtelier, canAccessClientResource } from '@/lib/permissions/guards';
import type { User } from '@/types/user';

const member: User = { id: 'member-1', name: 'Membro', email: 'membro@example.com', accountType: 'atelier_member', atelierId: 'atelier-a', role: 'finance', permissions: ['finance:read'], active: true };

describe('tenant and client access guards', () => {
  it('allows a member only in the atelier matching both profile and membership', () => {
    expect(canAccessAtelier(member, { userId: 'member-1', atelierId: 'atelier-a', role: 'finance', permissions: ['finance:read'], active: true }, 'atelier-a')).toBe(true);
    expect(canAccessAtelier(member, { userId: 'member-1', atelierId: 'atelier-b', role: 'finance', permissions: ['finance:read'], active: true }, 'atelier-b')).toBe(false);
  });
  it('rejects inactive and mismatched memberships', () => {
    expect(canAccessAtelier(member, { userId: 'member-1', atelierId: 'atelier-a', role: 'finance', permissions: [], active: false }, 'atelier-a')).toBe(false);
    expect(canAccessAtelier({ ...member, id: 'another-user' }, { userId: 'member-1', atelierId: 'atelier-a', role: 'finance', permissions: [], active: true }, 'atelier-a')).toBe(false);
  });
  it('limits clients to their own records unless the actor belongs to the atelier', () => {
    expect(canAccessClientResource('client-1', 'client-1', false)).toBe(true);
    expect(canAccessClientResource('client-1', 'client-2', false)).toBe(false);
    expect(canAccessClientResource('member-1', 'client-2', true)).toBe(true);
  });
});
