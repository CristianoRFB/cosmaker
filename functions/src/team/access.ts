import type { Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireTenantWorkspaceIdentity } from '../commercial/access';
import { mayManageTeam } from './policy';

export function validTeamDocumentId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 150
    && value.trim() === value
    && !value.includes('/');
}

export function teamIsoDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return null;
}

export async function requireTeamWorkspace(
  uid: string,
  claims: Record<string, unknown>,
  permission: 'team:read' | 'team:manage',
) {
  const identity = await requireTenantWorkspaceIdentity(uid, claims);
  if (!mayManageTeam(identity.member, permission)) {
    throw new HttpsError('permission-denied', 'Seu perfil não tem permissão para gerenciar a equipe.');
  }
  return identity;
}

export async function readActiveTeamActor(
  transaction: Transaction,
  atelierId: string,
  uid: string,
  permission: 'team:read' | 'team:manage',
) {
  const [atelier, profile, member] = await Promise.all([
    transaction.get(adminDb.doc(`ateliers/${atelierId}`)),
    transaction.get(adminDb.doc(`users/${uid}`)),
    transaction.get(adminDb.doc(`ateliers/${atelierId}/members/${uid}`)),
  ]);
  const profileData = profile.data();
  const memberData = member.data();
  if (!atelier.exists || atelier.data()?.active !== true
    || !profile.exists || profileData?.active !== true
    || profileData?.accountType !== 'atelier_member' || profileData.atelierId !== atelierId
    || !member.exists || memberData?.active !== true || !mayManageTeam(memberData, permission)) {
    throw new HttpsError('permission-denied', 'O vínculo ou a permissão de equipe mudou. Atualize a página.');
  }
  return { atelier: atelier.data()!, profile: profileData, member: memberData };
}
