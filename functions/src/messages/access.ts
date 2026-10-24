import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { Transaction } from 'firebase-admin/firestore';
import { adminDb } from '../admin';
import { requireVerifiedIdentity } from '../orders/access';
import { orderClientUid } from '../orders/client-ownership';
export const messageId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);
export function messageInput(value: unknown, fields: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !fields.includes(key))) throw new HttpsError('invalid-argument', 'A solicitação contém campos inválidos.');
  return value as Record<string, unknown>;
}
export function messagePermission(member: FirebaseFirestore.DocumentData | undefined, write = false) {
  return member?.active === true && (['owner', 'admin'].includes(member.role) || (Array.isArray(member.permissions)
    && (member.permissions.includes('orders:manage') || (!write && member.permissions.includes('orders:read')))));
}
export async function messageActor(tx: Transaction, auth: CallableRequest<unknown>['auth'], atelierId: string, orderId: string, write = false) {
  requireVerifiedIdentity(auth);
  const [atelier, profile, member, order] = await Promise.all([
    tx.get(adminDb.doc(`ateliers/${atelierId}`)), tx.get(adminDb.doc(`users/${auth!.uid}`)),
    tx.get(adminDb.doc(`ateliers/${atelierId}/members/${auth!.uid}`)), tx.get(adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`)),
  ]);
  if (atelier.data()?.active !== true || profile.data()?.active !== true || !order.exists) throw new HttpsError('permission-denied', 'Este pedido não está disponível para sua conta.');
  const value = order.data()!;
  const strongUid = await orderClientUid(tx, atelierId, value);
  const staff = profile.data()?.accountType === 'atelier_member' && profile.data()?.atelierId === atelierId && messagePermission(member.data(), write);
  const owns = profile.data()?.accountType === 'client' && strongUid === auth!.uid;
  if (!staff && !owns) throw new HttpsError('permission-denied', 'Este pedido não está disponível para sua conta.');
  return { staff, uid: auth!.uid, clientUid: strongUid ?? (owns ? auth!.uid : null), atelier: atelier.data()!, order: value };
}
