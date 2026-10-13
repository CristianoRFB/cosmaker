import { httpsCallable } from 'firebase/functions';
import { clientInputSchema, type ClientInput } from '@/schemas/client.schema';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { Client, ClientDetail, ClientPage } from '@/types/client';

function functionsClient() {
  return requireFirebase().functions;
}

export async function listAtelierClients(input: { search?: string; cursor?: string | null; limit?: number } = {}) {
  const call = httpsCallable<typeof input, ClientPage>(functionsClient(), 'listAtelierClients');
  return (await call(input)).data;
}

export async function saveAtelierClient(input: ClientInput, clientId?: string) {
  const parsed = clientInputSchema.parse(input);
  const payload = { ...parsed, ...(clientId ? { clientId } : {}) };
  const call = httpsCallable<typeof payload, { clientId: string }>(functionsClient(), 'saveAtelierClient');
  return (await call(payload)).data;
}

export async function addAtelierClientInteraction(clientId: string, note: string, requestId = crypto.randomUUID()) {
  const call = httpsCallable<{ clientId: string; note: string; requestId: string }, { interactionId: string }>(functionsClient(), 'addAtelierClientInteraction');
  return (await call({ clientId, note, requestId })).data;
}

export async function getAtelierClient(clientId: string) {
  const call = httpsCallable<{ clientId: string }, ClientDetail>(functionsClient(), 'getAtelierClient');
  return (await call({ clientId })).data;
}

export type { Client };
