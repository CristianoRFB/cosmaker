import type { Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireTenantWorkspaceIdentity } from '../commercial/access';

export function validSchedulingId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 150
    && value.trim() === value && !value.includes('/');
}

type SchedulingPermission = 'schedule:read' | 'schedule:write' | 'events:read' | 'events:write' | 'team:read' | 'team:manage' | 'orders:read';

export function schedulingPermission(member: FirebaseFirestore.DocumentData, permission: SchedulingPermission) {
  if (member.role === 'owner' || member.role === 'admin') return true;
  const permissions = Array.isArray(member.permissions) ? member.permissions : [];
  return permissions.includes(permission)
    || (permission === 'schedule:read' && permissions.includes('schedule:write'))
    || (permission === 'events:read' && permissions.includes('events:write'))
    || (permission === 'team:read' && permissions.includes('team:manage'));
}

export async function requireSchedulingWorkspace(uid: string, claims: Record<string, unknown>, permission: Exclude<SchedulingPermission, 'team:manage'>) {
  const identity = await requireTenantWorkspaceIdentity(uid, claims);
  if (!schedulingPermission(identity.member, permission)) {
    throw new HttpsError('permission-denied', 'Seu perfil não tem permissão para acessar este planejamento.');
  }
  return identity;
}

export async function readActiveSchedulingActor(
  transaction: Transaction,
  atelierId: string,
  uid: string,
  permission: Exclude<SchedulingPermission, 'team:manage'>,
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
    || !member.exists || memberData?.active !== true || !schedulingPermission(memberData, permission)) {
    throw new HttpsError('permission-denied', 'O vínculo ou a permissão de planejamento mudou. Atualize a página.');
  }
  return { atelier: atelierData!, profile: profileData!, member: memberData! };
}
