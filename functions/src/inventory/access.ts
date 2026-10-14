import { HttpsError } from 'firebase-functions/v2/https';
import type { Transaction } from 'firebase-admin/firestore';
import { adminDb } from '../admin';
import { requireTenantWorkspaceIdentity } from '../commercial/access';

export type InventoryPermission = 'inventory:read' | 'inventory:write';

export function validInventoryId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 150
    && value.trim() === value && !value.includes('/');
}

export function inventoryPermission(member: FirebaseFirestore.DocumentData, permission: InventoryPermission) {
  if (member.role === 'owner' || member.role === 'admin') return true;
  const permissions = Array.isArray(member.permissions) ? member.permissions : [];
  return permissions.includes(permission)
    || (permission === 'inventory:read' && permissions.includes('inventory:write'));
}

export async function requireInventoryWorkspace(uid: string, claims: Record<string, unknown>, permission: InventoryPermission) {
  const identity = await requireTenantWorkspaceIdentity(uid, claims);
  if (!inventoryPermission(identity.member, permission)) {
    throw new HttpsError('permission-denied', 'Seu perfil não tem permissão para acessar o estoque deste ateliê.');
  }
  return identity;
}

export async function readActiveInventoryActor(
  transaction: Transaction,
  atelierId: string,
  uid: string,
  permission: InventoryPermission,
) {
  const [atelier, profile, member] = await Promise.all([
    transaction.get(adminDb.doc(`ateliers/${atelierId}`)),
    transaction.get(adminDb.doc(`users/${uid}`)),
    transaction.get(adminDb.doc(`ateliers/${atelierId}/members/${uid}`)),
  ]);
  const atelierData = atelier.data();
  const profileData = profile.data();
  const memberData = member.data();
  if (!atelier.exists || atelierData?.active !== true || !profile.exists || profileData?.active !== true
    || profileData?.accountType !== 'atelier_member' || profileData?.atelierId !== atelierId
    || !member.exists || memberData?.active !== true || !inventoryPermission(memberData, permission)) {
    throw new HttpsError('permission-denied', 'O vínculo ou a permissão de estoque mudou. Atualize a página.');
  }
  return { atelier: atelierData!, profile: profileData!, member: memberData! };
}
