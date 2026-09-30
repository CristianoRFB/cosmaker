import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { isoDate, requirePlatformAdmin } from './platform-admin';

export const getPlatformOverview = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  await requirePlatformAdmin(call.auth.uid, call.auth.token);

  const [atelierCount, activeAtelierCount, suspendedAtelierCount, userCount, subscriptionCount, auditSnapshot] = await Promise.all([
    adminDb.collection('ateliers').count().get(),
    adminDb.collection('ateliers').where('active', '==', true).count().get(),
    adminDb.collection('ateliers').where('active', '==', false).count().get(),
    adminDb.collection('users').count().get(),
    adminDb.collection('subscriptions').where('status', '==', 'active').count().get(),
    adminDb.collection('auditLogs').orderBy('timestamp', 'desc').limit(8).get(),
  ]);

  return {
    totals: {
      ateliers: atelierCount.data().count,
      activeAteliers: activeAtelierCount.data().count,
      suspendedAteliers: suspendedAtelierCount.data().count,
      users: userCount.data().count,
      activeSubscriptions: subscriptionCount.data().count,
    },
    recentActivity: auditSnapshot.docs.map((snapshot) => {
      const data = snapshot.data();
      return {
        id: snapshot.id,
        actorId: String(data.actorId ?? ''),
        atelierId: typeof data.atelierId === 'string' ? data.atelierId : null,
        action: String(data.action ?? 'unknown'),
        entity: String(data.entity ?? 'unknown'),
        entityId: String(data.entityId ?? ''),
        timestamp: isoDate(data.timestamp),
      };
    }),
  };
});
