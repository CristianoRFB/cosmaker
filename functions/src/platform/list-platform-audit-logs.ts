import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { isoDate, requirePlatformAdmin } from './platform-admin';

export const listPlatformAuditLogs = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  await requirePlatformAdmin(call.auth.uid, call.auth.token);

  const requestedLimit = Number(call.data?.limit);
  const pageSize = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 25;
  const cursor = typeof call.data?.cursor === 'string' ? call.data.cursor : null;
  let query = adminDb.collection('auditLogs').orderBy('timestamp', 'desc').limit(pageSize + 1);
  if (cursor) {
    const cursorSnapshot = await adminDb.doc(`auditLogs/${cursor}`).get();
    if (!cursorSnapshot.exists) throw new HttpsError('invalid-argument', 'O cursor da auditoria expirou. Atualize a página.');
    query = query.startAfter(cursorSnapshot);
  }
  const result = await query.get();
  const hasMore = result.docs.length > pageSize;
  const page = result.docs.slice(0, pageSize);
  return {
    entries: page.map((snapshot) => {
      const data = snapshot.data();
      return {
        id: snapshot.id,
        actorId: String(data.actorId ?? ''),
        atelierId: typeof data.atelierId === 'string' ? data.atelierId : null,
        action: String(data.action ?? 'unknown'),
        entity: String(data.entity ?? 'unknown'),
        entityId: String(data.entityId ?? ''),
        before: data.before ?? null,
        after: data.after ?? null,
        timestamp: isoDate(data.timestamp),
      };
    }),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
});
