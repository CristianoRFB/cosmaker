import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';

function toIso(value: unknown) {
  return value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function'
    ? value.toDate().toISOString()
    : null;
}

export const listClientMeasurementProfiles = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para consultar suas medidas.');
  if (call.auth.token.email_verified !== true) throw new HttpsError('failed-precondition', 'Confirme seu e-mail para consultar suas medidas.');

  const profiles = await adminDb.collectionGroup('measurementProfiles')
    .where('clientId', '==', call.auth.uid)
    .orderBy('updatedAt', 'desc')
    .limit(100)
    .get();

  const records = await Promise.all(profiles.docs.map(async (snapshot) => {
    const path = snapshot.ref.path.split('/');
    const atelierId = path[1];
    const clientId = snapshot.data().clientId;
    if (path[0] !== 'ateliers' || path[2] !== 'measurementProfiles' || typeof clientId !== 'string') return null;
    const client = await adminDb.doc(`ateliers/${atelierId}/clients/${clientId}`).get();
    if (!client.exists || client.data()?.userId !== call.auth!.uid) return null;
    const data = snapshot.data();
    return {
      id: snapshot.id,
      atelierId,
      clientId,
      name: typeof data.name === 'string' ? data.name : 'Ficha de medidas',
      active: data.active === true,
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt),
    };
  }));
  return { profiles: records.filter((profile) => profile !== null) };
});
