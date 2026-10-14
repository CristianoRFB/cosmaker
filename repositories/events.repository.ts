import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { EventInput } from '@/schemas/event.schema';
import type { AtelierEvent } from '@/types/event';

function functionsClient() { return requireFirebase().functions; }

export async function listAtelierEvents(input: { fromDate: string; toDate: string }) {
  const call = httpsCallable<typeof input, { events: AtelierEvent[] }>(functionsClient(), 'listAtelierEvents');
  return (await call(input)).data;
}

export async function createAtelierEvent(input: EventInput & { requestId: string }) {
  const call = httpsCallable<typeof input, { eventId: string; status: 'active'; alreadyCreated: boolean }>(functionsClient(), 'createAtelierEvent');
  return (await call(input)).data;
}

export async function updateAtelierEvent(input: EventInput & { eventId: string }) {
  const call = httpsCallable<typeof input, { eventId: string; status: 'updated' }>(functionsClient(), 'updateAtelierEvent');
  return (await call(input)).data;
}

export async function cancelAtelierEvent(eventId: string) {
  const call = httpsCallable<{ eventId: string }, { eventId: string; status: 'cancelled' }>(functionsClient(), 'cancelAtelierEvent');
  return (await call({ eventId })).data;
}
