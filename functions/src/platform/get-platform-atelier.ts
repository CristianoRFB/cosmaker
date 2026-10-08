import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { isoDate, publicAtelierSnapshot, requirePlatformAdmin } from './platform-admin';
import { resolveCommercialState } from '../commercial/entitlements';
import { commercialConfigRef, commercialStateRef } from '../commercial/data';

export const getPlatformAtelier = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  await requirePlatformAdmin(call.auth.uid, call.auth.token);
  const atelierId = typeof call.data?.atelierId === 'string' ? call.data.atelierId.trim() : '';
  if (!atelierId || atelierId.length > 150 || atelierId.includes('/')) throw new HttpsError('invalid-argument', 'Identificador do ateliê inválido.');

  const atelierRef = adminDb.doc(`ateliers/${atelierId}`);
  const snapshot = await atelierRef.get();
  if (!snapshot.exists) throw new HttpsError('not-found', 'O ateliê não foi encontrado.');
  const data = snapshot.data()!;
  const [ownerSnapshot, memberCount, clientCount, orderCount, requestCount, subscriptionSnapshot, commercialSnapshot, configSnapshot, auditSnapshot] = await Promise.all([
    typeof data.ownerId === 'string' ? adminDb.doc(`users/${data.ownerId}`).get() : Promise.resolve(null),
    atelierRef.collection('members').count().get(),
    atelierRef.collection('clients').count().get(),
    atelierRef.collection('orders').count().get(),
    atelierRef.collection('quoteRequests').count().get(),
    adminDb.collection('subscriptions').where('atelierId', '==', atelierId).limit(1).get(),
    commercialStateRef(atelierId).get(),
    commercialConfigRef(atelierId).get(),
    adminDb.collection('auditLogs').where('atelierId', '==', atelierId).limit(100).get(),
  ]);
  const owner = ownerSnapshot?.data();
  const subscription = subscriptionSnapshot.docs[0]?.data();
  const commercialResolution = resolveCommercialState({ commercialState: commercialSnapshot.exists ? commercialSnapshot.data() : undefined });

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
    commercial: {
      assignment: commercialResolution.assignment,
      state: commercialResolution.assignment === 'assigned' ? commercialResolution.state : null,
      error: commercialResolution.assignment === 'invalid_state' ? commercialResolution.error : null,
      featureConfig: configSnapshot.data()?.featureConfig ?? {},
      demoWorkspace: data.demoWorkspace === true,
    },
    commercialAudit: auditSnapshot.docs
      .filter((entry) => String(entry.data().action ?? '').startsWith('platform.commercial.'))
      .map((entry) => ({
        id: entry.id,
        actorId: typeof entry.data().actorId === 'string' ? entry.data().actorId : 'desconhecido',
        action: typeof entry.data().action === 'string' ? entry.data().action : 'ação comercial',
        reason: typeof entry.data().reason === 'string' ? entry.data().reason : '',
        before: entry.data().before ?? null,
        after: entry.data().after ?? null,
        timestamp: isoDate(entry.data().timestamp),
      }))
      .sort((left, right) => String(right.timestamp ?? '').localeCompare(String(left.timestamp ?? '')))
      .slice(0, 20),
  };
});
