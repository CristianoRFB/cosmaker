'use client';

import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { Quote, QuoteItem, QuoteResponse } from '@/types/quote';
import type { QuoteRequest, QuoteRequestReference } from '@/types/quote-request';
import type { QuoteDraftInput } from '@/schemas/quote.schema';

export async function listQuoteRequests(atelierId: string) {
  const { db } = requireFirebase();
  const result = await getDocs(query(collection(db, 'ateliers', atelierId, 'quoteRequests'), orderBy('createdAt', 'desc'), limit(100)));
  return result.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as QuoteRequest);
}

export async function getQuoteRequest(atelierId: string, requestId: string) {
  const { db } = requireFirebase();
  const requestSnapshot = await getDoc(doc(db, 'ateliers', atelierId, 'quoteRequests', requestId));
  if (!requestSnapshot.exists()) return null;
  const referenceSnapshots = await getDocs(query(collection(db, 'ateliers', atelierId, 'quoteRequests', requestId, 'references'), orderBy('createdAt', 'asc')));
  const references = referenceSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data(), downloadUrl: null }) as QuoteRequestReference);
  return {
    request: { id: requestSnapshot.id, ...requestSnapshot.data() } as QuoteRequest,
    references,
  };
}

export async function listQuotes(atelierId: string) {
  const { db } = requireFirebase();
  const result = await getDocs(query(collection(db, 'ateliers', atelierId, 'quotes'), orderBy('createdAt', 'desc'), limit(100)));
  return result.docs.map((snapshot) => ({ id: snapshot.id, atelierId, ...snapshot.data() } as Quote));
}

export interface ClientQuotesPage { quotes: Quote[]; nextCursor: string | null }
export interface QuoteDetailRecord { quote: Quote; items: QuoteItem[]; responses: QuoteResponse[]; nextResponsesCursor?: string | null }

export async function listClientQuotes(cursor?: string): Promise<ClientQuotesPage> {
  const { functions } = requireFirebase();
  return (await httpsCallable<{ cursor?: string }, ClientQuotesPage>(functions, 'listClientQuotes')(cursor ? { cursor } : {})).data;
}

export async function getClientQuote(atelierId: string, quoteId: string, responseCursor?: string): Promise<QuoteDetailRecord> {
  const { functions } = requireFirebase();
  return (await httpsCallable<{ atelierId: string; quoteId: string; responseCursor?: string }, QuoteDetailRecord>(functions, 'getClientQuote')({ atelierId, quoteId, ...(responseCursor ? { responseCursor } : {}) })).data;
}

export async function getQuote(atelierId: string, quoteId: string) {
  const { db } = requireFirebase();
  const quoteRef = doc(db, 'ateliers', atelierId, 'quotes', quoteId);
  const quoteSnapshot = await getDoc(quoteRef);
  if (!quoteSnapshot.exists()) return null;
  const [itemSnapshots, responseSnapshots] = await Promise.all([
    getDocs(query(collection(quoteRef, 'items'), orderBy('createdAt', 'asc'))),
    getDocs(query(collection(quoteRef, 'responses'), orderBy('createdAt', 'asc'))),
  ]);
  return {
    quote: { id: quoteSnapshot.id, atelierId, ...quoteSnapshot.data() } as Quote,
    items: itemSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as QuoteItem),
    responses: responseSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as QuoteResponse)),
  };
}

export async function createQuoteDraft(atelierId: string, input: QuoteDraftInput) {
  const { functions } = requireFirebase();
  const create = httpsCallable<QuoteDraftInput & { atelierId: string }, { quoteId: string; subtotal: number; total: number; depositAmount: number }>(functions, 'createQuoteDraft');
  return (await create({ ...input, atelierId })).data;
}

export async function publishQuote(atelierId: string, quoteId: string) {
  const { functions } = requireFirebase();
  const publish = httpsCallable<{ atelierId: string; quoteId: string }, { quoteId: string; status: 'sent' }>(functions, 'publishQuote');
  return (await publish({ atelierId, quoteId })).data;
}

export async function respondToQuote(atelierId: string, quoteId: string, decision: 'approved' | 'rejected' | 'request_changes', comment: string) {
  const { functions } = requireFirebase();
  const respond = httpsCallable<{ atelierId: string; quoteId: string; decision: string; comment: string }, { quoteId: string; decision: string }>(functions, 'respondToQuote');
  return (await respond({ atelierId, quoteId, decision, comment })).data;
}

export async function downloadQuoteRequestReference(requestId: string, reference: QuoteRequestReference) {
  const { app, auth } = requireFirebase();
  if (!app || !auth.currentUser) throw new Error('Entre na sua conta para acessar referências.');
  const projectId = app.options.projectId;
  const base = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true'
    ? `http://${process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1'}:${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT || '5001'}/${projectId}/us-central1`
    : `https://us-central1-${projectId}.cloudfunctions.net`;
  const url = new URL(`${base}/downloadQuoteReferenceBytes`); url.searchParams.set('requestId', requestId); url.searchParams.set('referenceId', reference.id);
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(120_000), headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` } });
  if (!response.ok) { const payload = await response.json().catch(() => null); throw new Error(payload?.error?.message || 'A referência está indisponível. Atualize a solicitação.'); }
  const blob = await response.blob(); const objectUrl = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = objectUrl; link.download = reference.originalName; link.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
