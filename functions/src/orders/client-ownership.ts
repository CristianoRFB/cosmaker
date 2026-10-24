import type { Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';

function uid(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !value.length || value.length > 128 || value.includes('/')) throw new HttpsError('permission-denied', 'O vínculo do pedido precisa ser revisado pelo ateliê.');
  return value;
}

/** Existing orders require a durable UID. A reusable contact email is not authority. */
export async function orderClientUid(tx: Transaction, atelierId: string, order: FirebaseFirestore.DocumentData) {
  if (order.atelierId !== undefined && order.atelierId !== atelierId) throw new HttpsError('permission-denied', 'O pedido não pertence a este ateliê.');
  const orderUid = uid(order.clientUserId);
  let clientUid: string | null = null;
  if (order.clientId !== undefined && order.clientId !== null) {
    if (typeof order.clientId !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(order.clientId)) throw new HttpsError('permission-denied', 'O cadastro vinculado precisa de revisão.');
    const client = await tx.get(adminDb.doc(`ateliers/${atelierId}/clients/${order.clientId}`));
    if (!client.exists) throw new HttpsError('permission-denied', 'O cadastro vinculado precisa de revisão.');
    clientUid = uid(client.get('userId'));
  }
  if (orderUid && clientUid && orderUid !== clientUid) throw new HttpsError('permission-denied', 'Os vínculos do pedido precisam de revisão.');
  return orderUid ?? clientUid;
}
