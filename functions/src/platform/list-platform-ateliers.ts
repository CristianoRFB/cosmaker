import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { publicAtelierSnapshot, requirePlatformAdmin } from './platform-admin';
import { resolveCommercialState } from '../commercial/entitlements';
import { commercialStateRef } from '../commercial/data';

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
    const [ownerSnapshot, commercialSnapshot] = await Promise.all([
      ownerId ? adminDb.doc(`users/${ownerId}`).get() : Promise.resolve(null),
      commercialStateRef(snapshot.id).get(),
    ]);
    const ownerEmail = ownerSnapshot?.data()?.email;
    const commercialResolution = resolveCommercialState({ commercialState: commercialSnapshot?.exists ? commercialSnapshot.data() : undefined });
    return {
      ...publicAtelierSnapshot(snapshot.id, data),
      email: typeof data.email === 'string' ? data.email : typeof ownerEmail === 'string' ? ownerEmail : null,
      commercial: {
        assignment: commercialResolution.assignment,
        planId: commercialResolution.assignment === 'assigned' ? commercialResolution.state.planId : null,
        subscriptionStatus: commercialResolution.assignment === 'assigned' ? commercialResolution.state.subscriptionStatus : null,
        trialUntil: commercialResolution.assignment === 'assigned' ? commercialResolution.state.trialUntil ?? null : null,
        demoWorkspace: data.demoWorkspace === true,
      },
    };
  }));
  return {
    ateliers,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
});
