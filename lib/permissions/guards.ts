import type { AtelierPermission } from './roles';
import { hasAtelierPermission } from './roles';
import type { User } from '@/types/user';

export interface AtelierMembership { atelierId: string; userId: string; role: User['role']; permissions: string[]; active: boolean; }

export function canAccessAtelier(user: User | null, membership: AtelierMembership | null, atelierId: string) {
  return Boolean(user && membership && user.id === membership.userId && user.accountType === 'atelier_member'
    && user.atelierId === atelierId && membership.atelierId === atelierId && membership.active);
}

export function canAccessClientResource(actorUserId: string | null, resourceOwnerUserId: string | null, isAtelierMember: boolean) {
  return isAtelierMember || Boolean(actorUserId && resourceOwnerUserId && actorUserId === resourceOwnerUserId);
}

export function requireAtelierPermission(role: User['role'], permissions: string[], permission: AtelierPermission) {
  if (!hasAtelierPermission(role as Parameters<typeof hasAtelierPermission>[0], permissions, permission)) {
    throw new Error(`Permissão necessária: ${permission}`);
  }
}
