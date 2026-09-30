import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { measurementInputSchema, measurementProfileInputSchema, type MeasurementInput, type MeasurementProfileInput } from '@/schemas/measurement.schema';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { Measurement, MeasurementProfile } from '@/types/measurement';

export async function listClientMeasurementProfiles(clientId: string) {
  const { functions } = requireFirebase();
  const list = httpsCallable<undefined, { profiles: MeasurementProfile[] }>(functions, 'listClientMeasurementProfiles');
  return (await list()).data.profiles.filter((profile) => profile.clientId === clientId);
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
