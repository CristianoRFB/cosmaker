import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { isoDate, publicAtelierSnapshot, requirePlatformAdmin } from './platform-admin';

export const getPlatformAtelier = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  await requirePlatformAdmin(call.auth.uid, call.auth.token);
  const atelierId = typeof call.data?.atelierId === 'string' ? call.data.atelierId.trim() : '';
  if (!atelierId || atelierId.length > 150 || atelierId.includes('/')) throw new HttpsError('invalid-argument', 'Identificador do ateliê inválido.');

  const atelierRef = adminDb.doc(`ateliers/${atelierId}`);
  const snapshot = await atelierRef.get();
  if (!snapshot.exists) throw new HttpsError('not-found', 'O ateliê não foi encontrado.');
  const data = snapshot.data()!;
  const [ownerSnapshot, memberCount, clientCount, orderCount, requestCount, subscriptionSnapshot] = await Promise.all([
    typeof data.ownerId === 'string' ? adminDb.doc(`users/${data.ownerId}`).get() : Promise.resolve(null),
    atelierRef.collection('members').count().get(),
    atelierRef.collection('clients').count().get(),
    atelierRef.collection('orders').count().get(),
    atelierRef.collection('quoteRequests').count().get(),
    adminDb.collection('subscriptions').where('atelierId', '==', atelierId).limit(1).get(),
  ]);
  const owner = ownerSnapshot?.data();
  const subscription = subscriptionSnapshot.docs[0]?.data();

  return {
    atelier: {
      ...publicAtelierSnapshot(snapshot.id, data),
      description: typeof data.description === 'string' ? data.description : null,
      phone: typeof data.phone === 'string' ? data.phone : null,
    },
    owner: owner ? {
      id: ownerSnapshot!.id,
      name: typeof owner.name === 'string' ? owner.name : null,
      email: typeof owner.email === 'string' ? owner.email : null,
    } : null,
    counts: {
      members: memberCount.data().count,
      clients: clientCount.data().count,
      orders: orderCount.data().count,
      quoteRequests: requestCount.data().count,
    },
    subscription: subscription ? {
      id: subscriptionSnapshot.docs[0].id,
      status: typeof subscription.status === 'string' ? subscription.status : null,
      plan: typeof subscription.plan === 'string' ? subscription.plan : null,
      currentPeriodEnd: isoDate(subscription.currentPeriodEnd),
    } : null,
  };
});
