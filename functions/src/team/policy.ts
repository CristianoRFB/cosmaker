export const teamRoles = ['admin', 'cosmaker', 'assistant', 'finance'] as const;
export type TeamRole = typeof teamRoles[number];

export const teamPermissions = [
  'atelier:settings',
  'team:read', 'team:manage',
  'clients:read', 'clients:write', 'clients:delete',
  'quotes:read', 'quotes:write',
  'orders:read', 'orders:manage',
  'payments:write',
  'measurements:read', 'measurements:write',
  'portfolio:manage',
  'finance:read', 'finance:write',
  'inventory:read', 'inventory:write',
  'schedule:read', 'schedule:write',
  'services:read', 'services:write',
  'events:read', 'events:write',
] as const;

const permissionSet = new Set<string>(teamPermissions);

export function normalizeTeamEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function parseTeamRole(value: unknown): TeamRole | null {
  return typeof value === 'string' && teamRoles.includes(value as TeamRole) ? value as TeamRole : null;
}

export function parseTeamPermissions(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > teamPermissions.length) return null;
  if (value.some((item) => typeof item !== 'string' || !permissionSet.has(item))) return null;
  const unique = [...new Set(value as string[])];
  return unique.length === value.length ? unique.sort() : null;
}

export function mayManageTeam(member: FirebaseFirestore.DocumentData, permission: 'team:read' | 'team:manage') {
  const permissions = Array.isArray(member.permissions) ? member.permissions : [];
  return member.role === 'owner' || member.role === 'admin'
    || permissions.includes(permission)
    || (permission === 'team:read' && permissions.includes('team:manage'));
}

export function mayGrantTeamRole(
  actor: FirebaseFirestore.DocumentData,
  role: TeamRole,
  permissions: string[],
) {
  if (role === 'admin' && actor.role !== 'owner') return false;
  if (actor.role === 'owner' || actor.role === 'admin') return true;
  const actorPermissions = Array.isArray(actor.permissions) ? actor.permissions : [];
  return role !== 'admin' && permissions.every((permission) => actorPermissions.includes(permission));
}

export function mayChangeTeamMember(actor: FirebaseFirestore.DocumentData, target: FirebaseFirestore.DocumentData) {
  if (target.role === 'owner') return false;
  if (target.role === 'admin' && actor.role !== 'owner') return false;
  if (!mayManageTeam(actor, 'team:manage')) return false;
  if (actor.role === 'owner' || actor.role === 'admin') return true;
  const actorPermissions = Array.isArray(actor.permissions) ? actor.permissions : [];
  const targetPermissions = Array.isArray(target.permissions) ? target.permissions : [];
  return targetPermissions.every((permission: string) => actorPermissions.includes(permission));
}
