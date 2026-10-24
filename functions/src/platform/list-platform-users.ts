import { FieldPath } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminAuth, adminDb } from '../admin';
import { identity } from '../orders/order-file-bytes';
import { messageId, messageInput } from '../messages/access';
import { hasPlatformAdminAccess, requirePlatformAdmin } from './platform-admin';

export const listPlatformUsers = onCall(async call => {
  const token = await identity(call.rawRequest);
  if (token.uid !== call.auth?.uid) throw new HttpsError('unauthenticated', 'Entre novamente para consultar os perfis.');
  const data = messageInput(call.data ?? {}, ['cursor']);
  let cursor: string | null = null;
  if (data.cursor !== undefined) {
    if (typeof data.cursor !== 'string' || data.cursor.length > 1024) throw new HttpsError('invalid-argument', 'Página inválida.');
    cursor = Buffer.from(data.cursor, 'base64url').toString();
    if (!cursor || cursor.length > 128 || /[\x00-\x1f/]/.test(cursor) || ['.', '..'].includes(cursor) || Buffer.from(cursor).toString('base64url') !== data.cursor) throw new HttpsError('invalid-argument', 'Página inválida.');
  }
  const page = await adminDb.runTransaction(async tx => {
    const profile = await tx.get(adminDb.doc(`users/${token.uid}`));
    if (!hasPlatformAdminAccess(token, profile.data())) throw new HttpsError('permission-denied', 'Acesso restrito à administração da plataforma.');
    let query = adminDb.collection('users').orderBy(FieldPath.documentId()).limit(51);
    if (cursor) query = query.startAfter(cursor);
    const result = await tx.get(query);
    const text = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : null;
    return { users: result.docs.slice(0, 50).map(record => ({
      id: record.id, name: text(record.get('name'), 256), email: text(record.get('email'), 254),
      accountType: ['client', 'atelier_member', 'platform_admin'].includes(record.get('accountType')) ? record.get('accountType') as string : 'unknown',
      role: text(record.get('role'), 80), active: record.get('active') === true,
      atelierId: messageId(record.get('atelierId')) ? record.get('atelierId') as string : null,
    })), nextCursor: result.size > 50 ? Buffer.from(result.docs[49].id).toString('base64url') : null };
  });
  const identifiers = page.users.filter(user => user.id.length <= 128 && !/[\x00-\x1f/]/.test(user.id)).map(user => ({ uid: user.id }));
  const identities = identifiers.length ? await adminAuth.getUsers(identifiers) : { users: [] };
  const accounts = new Map(identities.users.map(user => [user.uid, user]));
  await requirePlatformAdmin(token.uid, token);
  return { ...page, users: page.users.map(user => {
    const account = accounts.get(user.id);
    return { ...user, authStatus: account ? account.disabled ? 'disabled' : 'enabled' : 'missing', emailVerified: account?.emailVerified ?? null };
  }) };
});
