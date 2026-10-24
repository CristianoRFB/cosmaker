import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, where, limit, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { measurementInputSchema, measurementProfileInputSchema, type MeasurementInput, type MeasurementProfileInput } from '@/schemas/measurement.schema';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { Measurement, MeasurementProfile } from '@/types/measurement';

export async function listClientMeasurementProfiles() {
  const { functions } = requireFirebase();
  const list = httpsCallable<undefined, { profiles: MeasurementProfile[] }>(functions, 'listClientMeasurementProfiles');
  return (await list()).data.profiles;
}

export async function getMeasurementProfile(atelierId: string, profileId: string) {
  const { db } = requireFirebase();
  const snapshot = await getDoc(doc(db, 'ateliers', atelierId, 'measurementProfiles', profileId));
  return snapshot.exists() ? ({ id: snapshot.id, atelierId, ...snapshot.data() } as MeasurementProfile) : null;
}

export async function listMeasurements(atelierId: string, profileId: string) {
  const { db } = requireFirebase();
  const result = await getDocs(query(collection(db, 'ateliers', atelierId, 'measurementProfiles', profileId, 'measurements'), orderBy('label', 'asc')));
  return result.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as Measurement);
}

export async function createMeasurementProfile(atelierId: string, clientId: string, input: MeasurementProfileInput) {
  const parsed = measurementProfileInputSchema.parse(input);
  const { db } = requireFirebase();
  const reference = await addDoc(collection(db, 'ateliers', atelierId, 'measurementProfiles'), {
    clientId,
    name: parsed.name,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function addMeasurement(atelierId: string, profileId: string, input: MeasurementInput) {
  const parsed = measurementInputSchema.parse(input);
  const { db } = requireFirebase();
  return addDoc(collection(db, 'ateliers', atelierId, 'measurementProfiles', profileId, 'measurements'), {
    ...parsed,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateMeasurement(atelierId: string, profileId: string, measurement: Measurement) {
  const parsed = measurementInputSchema.parse(measurement);
  const { db } = requireFirebase();
  await updateDoc(doc(db, 'ateliers', atelierId, 'measurementProfiles', profileId, 'measurements', measurement.id), {
    value: parsed.value,
    unit: parsed.unit,
    notes: parsed.notes,
    updatedAt: serverTimestamp(),
  });
}

export async function listAtelierClientMeasurementProfiles(atelierId: string, clientId: string) {
  const { db } = requireFirebase();
  const result = await getDocs(query(collection(db, 'ateliers', atelierId, 'measurementProfiles'), where('clientId', '==', clientId), limit(501)));
  if (result.size > 500) throw new Error('As fichas precisam de uma consulta assistida.');
  return result.docs.map(record => ({ id: record.id, atelierId, ...record.data() }) as MeasurementProfile);
}
export async function createClientMeasurementProfile(atelierId: string, name: string, requestId: string) {
  return (await httpsCallable<Record<string, unknown>, { profileId: string }>(requireFirebase().functions, 'createClientMeasurementProfile')({ atelierId, name, requestId })).data.profileId;
}

export async function updateMeasurementProfile(atelierId: string, profileId: string, input: { name: string; active: boolean }) {
  const parsed = measurementProfileInputSchema.parse(input);
  if (typeof input.active !== 'boolean') throw new Error('Estado da ficha inválido.');
  await updateDoc(doc(requireFirebase().db, 'ateliers', atelierId, 'measurementProfiles', profileId), { name: parsed.name, active: input.active, updatedAt: serverTimestamp() });
}
