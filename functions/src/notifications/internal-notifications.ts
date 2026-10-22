import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireVerifiedIdentity } from '../orders/access';
import { messageActor, messageId, messageInput, messagePermission } from '../messages/access';

export const listInternalNotifications = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = messageInput(call.data, ['cursor']);
  if (data.cursor !== undefined && (typeof data.cursor !== 'string' || !/^[A-Za-z0-9_-]{1,1000}$/.test(data.cursor))) throw new HttpsError('invalid-argument', 'Página de notificações inválida.');
  const profile = await adminDb.doc(`users/${call.auth!.uid}`).get();
  if (profile.data()?.active !== true || !['client', 'atelier_member'].includes(profile.data()?.accountType)) throw new HttpsError('permission-denied', 'Sua conta não tem acesso às notificações internas.');
  const staff = profile.data()!.accountType === 'atelier_member'; const tenant = staff ? profile.data()!.atelierId : null;
  if (staff) {
    if (!messageId(tenant)) throw new HttpsError('permission-denied', 'O vínculo do ateliê é inválido.');
    const [atelier, member] = await Promise.all([adminDb.doc(`ateliers/${tenant}`).get(), adminDb.doc(`ateliers/${tenant}/members/${call.auth!.uid}`).get()]);
    if (atelier.data()?.active !== true || !messagePermission(member.data())) throw new HttpsError('permission-denied', 'Seu perfil não tem acesso às notificações de pedidos.');
  }
  let query = adminDb.collectionGroup('notifications').where('userId', '==', call.auth!.uid).orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(51);
  if (data.cursor) {
    let path = '';
    try { path = Buffer.from(String(data.cursor), 'base64url').toString('utf8'); } catch { throw new HttpsError('invalid-argument', 'A página expirou.'); }
    const parts = path.split('/');
    if (parts.length !== 4 || parts[0] !== 'ateliers' || parts[2] !== 'notifications' || !messageId(parts[1]) || !messageId(parts[3])) throw new HttpsError('invalid-argument', 'A página expirou.');
    const cursor = await adminDb.doc(path).get();
    if (!cursor.exists || cursor.data()?.userId !== call.auth!.uid) throw new HttpsError('permission-denied', 'Esta página não pertence à sua conta.');
    query = query.startAfter(cursor);
  }
  const page = await query.get(); const records = page.docs.slice(0, 50); const notifications = [];
  for (const record of records) {
    const atelierId = record.ref.parent.parent!.id;
    if (staff && atelierId !== tenant) continue;
    const value = record.data();
    if (!messageId(value.orderId) || !['order_message', 'approval_required', 'order_updated'].includes(value.type)) continue;
    try {
      const view = await adminDb.runTransaction(async (tx) => {
        const actor = await messageActor(tx, call.auth, atelierId, value.orderId);
        const current = await tx.get(record.ref);
        if (current.data()?.userId !== actor.uid) return null;
        return { id: record.id, atelierId, orderId: value.orderId, type: value.type, title: String(current.data()!.title).slice(0, 160),
          message: String(current.data()!.message).slice(0, 140), read: current.data()!.read === true, createdAt: current.data()!.createdAt.toDate().toISOString() };
      });
      if (view) notifications.push(view);
    } catch (error) { if (!(error instanceof HttpsError) || error.code !== 'permission-denied') throw error; }
  }
  return { notifications, nextCursor: page.size > 50 ? Buffer.from(records.at(-1)!.ref.path).toString('base64url') : null };
});

export const markInternalNotificationRead = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = messageInput(call.data, ['atelierId', 'notificationId']);
  if (![data.atelierId, data.notificationId].every(messageId)) throw new HttpsError('invalid-argument', 'Notificação inválida.');
  const ref = adminDb.doc(`ateliers/${data.atelierId}/notifications/${data.notificationId}`);
  return adminDb.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists || current.data()?.userId !== call.auth!.uid || !messageId(current.data()?.orderId)) throw new HttpsError('permission-denied', 'A notificação não pertence à sua conta.');
    await messageActor(tx, call.auth, String(data.atelierId), current.data()!.orderId);
    if (current.data()?.read === true) return { alreadyApplied: true };
    tx.update(ref, { read: true, readAt: Timestamp.now() });
    return { alreadyApplied: false };
  });
});
