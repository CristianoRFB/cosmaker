import { HttpsError } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';

export async function requireOrderManager(atelierId: string, uid: string, permission: 'orders:read' | 'orders:manage' | 'payments:write') {
  const [atelier, member] = await Promise.all([
    adminDb.doc(`ateliers/${atelierId}`).get(),
    adminDb.doc(`ateliers/${atelierId}/members/${uid}`).get(),
  ]);
  const data = member.data();
  if (!atelier.exists || atelier.data()?.active !== true || !member.exists || data?.active !== true) {
    throw new HttpsError('permission-denied', 'A conta não pertence a um ateliê ativo.');
  }
  const permissions = Array.isArray(data.permissions) ? data.permissions : [];
  const isOwner = data.role === 'owner' || data.role === 'admin';
  const canManage = isOwner || permissions.includes(permission)
    || (permission === 'orders:read' && permissions.includes('orders:manage'))
    || (permission === 'payments:write' && permissions.includes('finance:write'));
  if (!canManage) throw new HttpsError('permission-denied', 'Você não tem permissão para esta operação.');
  return data;
}

export function requireVerifiedIdentity(auth: { token: Record<string, unknown> } | undefined) {
  if (!auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  if (auth.token.email_verified !== true) throw new HttpsError('failed-precondition', 'Confirme seu e-mail para continuar.');
  return auth.token;
}
