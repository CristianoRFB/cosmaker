import { describe, expect, it } from 'vitest';
import { mayChangeTeamMember, mayGrantTeamRole, mayManageTeam, normalizeTeamEmail, parseTeamPermissions, parseTeamRole } from '../../functions/src/team/policy';

describe('team policy', () => {
  it('normalizes email and accepts only current roles and permissions', () => {
    expect(normalizeTeamEmail('  PERSON@Example.Test ')).toBe('person@example.test');
    expect(normalizeTeamEmail('invalid-address')).toBeNull();
    expect(parseTeamRole('assistant')).toBe('assistant');
    expect(parseTeamRole('platform_admin')).toBeNull();
    expect(parseTeamPermissions(['clients:write', 'clients:read'])).toEqual(['clients:read', 'clients:write']);
    expect(parseTeamPermissions(['clients:read', 'clients:read'])).toBeNull();
    expect(parseTeamPermissions(['platform:manage'])).toBeNull();
  });

  it('keeps owner and admin powers distinct and scopes managers to their grants', () => {
    const owner = { role: 'owner', permissions: [] };
    const admin = { role: 'admin', permissions: [] };
    const manager = { role: 'assistant', permissions: ['team:manage', 'team:read', 'clients:read'] };
    const target = { role: 'assistant', permissions: ['clients:read'] };
    const strongerTarget = { role: 'cosmaker', permissions: ['clients:read', 'clients:write'] };
    const protectedOwner = { role: 'owner', permissions: [] };

    expect(mayManageTeam(owner, 'team:manage')).toBe(true);
    expect(mayManageTeam(admin, 'team:read')).toBe(true);
    expect(mayGrantTeamRole(admin, 'assistant', ['clients:write'])).toBe(true);
    expect(mayGrantTeamRole(admin, 'admin', [])).toBe(false);
    expect(mayGrantTeamRole(manager, 'assistant', ['clients:read'])).toBe(true);
    expect(mayGrantTeamRole(manager, 'assistant', ['clients:write'])).toBe(false);
    expect(mayChangeTeamMember(manager, target)).toBe(true);
    expect(mayChangeTeamMember(manager, strongerTarget)).toBe(false);
    expect(mayChangeTeamMember(owner, protectedOwner)).toBe(false);
  });
});
