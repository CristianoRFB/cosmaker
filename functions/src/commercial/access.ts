import { HttpsError } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { commercialConfigRef, commercialStateRef } from './data';

export interface TenantWorkspaceIdentity {
  atelierId: string;
  profile: FirebaseFirestore.DocumentData;
  atelier: FirebaseFirestore.DocumentData;
  member: FirebaseFirestore.DocumentData;
}

export async function requireTenantWorkspaceIdentity(uid: string, claims: Record<string, unknown>): Promise<TenantWorkspaceIdentity> {
  if (claims.email_verified !== true) throw new HttpsError('failed-precondition', 'Confirme seu e-mail para continuar.');
  const profileSnapshot = await adminDb.doc(`users/${uid}`).get();
  const profile = profileSnapshot.data();
  const atelierId = typeof profile?.atelierId === 'string' ? profile.atelierId : '';
  if (!profileSnapshot.exists || profile?.active !== true || profile.accountType !== 'atelier_member' || !atelierId || atelierId.includes('/')) {
    throw new HttpsError('permission-denied', 'A conta não está vinculada a um ateliê ativo.');
  }
  const [atelierSnapshot, memberSnapshot] = await Promise.all([
    adminDb.doc(`ateliers/${atelierId}`).get(),
    adminDb.doc(`ateliers/${atelierId}/members/${uid}`).get(),
  ]);
  const atelier = atelierSnapshot.data();
  const member = memberSnapshot.data();
  if (!atelierSnapshot.exists || atelier?.active !== true || !memberSnapshot.exists || member?.active !== true) {
    throw new HttpsError('permission-denied', 'A conta não pertence a um ateliê operacionalmente ativo.');
  }
  return { atelierId, profile, atelier, member };
}

export function requireCommercialOwner(member: FirebaseFirestore.DocumentData) {
  if (member.role === 'owner' || member.role === 'admin' || (Array.isArray(member.permissions) && member.permissions.includes('atelier:settings'))) return;
  throw new HttpsError('permission-denied', 'Esta operação exige a permissão de configurações do ateliê.');
}

/** Demo workspaces never issue signed uploads or record real financial confirmations. */
export async function requireNonDemoWorkspace(atelierId: string) {
  const atelier = await adminDb.doc(`ateliers/${atelierId}`).get();
  if (!atelier.exists || atelier.data()?.active !== true) throw new HttpsError('permission-denied', 'O ateliê não está operacionalmente ativo.');
  if (atelier.data()?.demoWorkspace === true) throw new HttpsError('failed-precondition', 'Esta ação sensível fica indisponível em uma demonstração.');
}

export async function readTenantCommercialDocuments(atelierId: string) {
  const [stateSnapshot, configSnapshot] = await Promise.all([
    commercialStateRef(atelierId).get(),
    commercialConfigRef(atelierId).get(),
  ]);
  return {
    commercialState: stateSnapshot.exists ? stateSnapshot.data() : undefined,
    featureConfig: configSnapshot.exists ? configSnapshot.data()?.featureConfig : undefined,
  };
}
