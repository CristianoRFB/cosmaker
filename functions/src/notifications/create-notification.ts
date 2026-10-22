import { createHash } from 'node:crypto';
import { Timestamp, type Transaction } from 'firebase-admin/firestore';
import { adminDb } from '../admin';
export interface InternalNotificationInput { atelierId: string; userId: string; eventId: string; type: 'order_message' | 'approval_required'; orderId: string; title: string; message: string }
/** Call only in the transaction that creates a new source event. No external delivery occurs. */
export function writeInternalNotification(transaction: Transaction, input: InternalNotificationInput) {
  const id = createHash('sha256').update(JSON.stringify([input.type, input.orderId, input.eventId, input.userId])).digest('hex');
  const { eventId, ...notification } = input;
  transaction.create(adminDb.doc(`ateliers/${input.atelierId}/notifications/${id}`), { ...notification, eventId, read: false, createdAt: Timestamp.now() });
  return id;
}
