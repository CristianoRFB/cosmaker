import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { publicAtelierSnapshot, requirePlatformAdmin } from './platform-admin';

export const listPlatformAteliers = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  await requirePlatformAdmin(call.auth.uid, call.auth.token);

  const requestedLimit = Number(call.data?.limit);
  const pageSize = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 25;
  const cursor = typeof call.data?.cursor === 'string' ? call.data.cursor : null;
  let query = adminDb.collection('ateliers').orderBy('name').limit(pageSize + 1);
  if (cursor) {
    const cursorSnapshot = await adminDb.doc(`ateliers/${cursor}`).get();
    if (!cursorSnapshot.exists) throw new HttpsError('invalid-argument', 'O cursor da lista expirou. Atualize a página.');
    query = query.startAfter(cursorSnapshot);
  }
  const result = await query.get();
  const hasMore = result.docs.length > pageSize;
  const page = result.docs.slice(0, pageSize);
  const ateliers = await Promise.all(page.map(async (snapshot) => {
    const data = snapshot.data();
    const ownerId = typeof data.ownerId === 'string' ? data.ownerId : null;
    const ownerSnapshot = ownerId ? await adminDb.doc(`users/${ownerId}`).get() : null;
    const ownerEmail = ownerSnapshot?.data()?.email;
    return {
      ...publicAtelierSnapshot(snapshot.id, data),
      email: typeof data.email === 'string' ? data.email : typeof ownerEmail === 'string' ? ownerEmail : null,
    };
  }));
  return {
    ateliers,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
});
