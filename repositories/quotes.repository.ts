'use client';

import { collection, collectionGroup, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref } from 'firebase/storage';
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
  const { db, storage } = requireFirebase();
  const requestSnapshot = await getDoc(doc(db, 'ateliers', atelierId, 'quoteRequests', requestId));
  if (!requestSnapshot.exists()) return null;
  const referenceSnapshots = await getDocs(query(collection(db, 'ateliers', atelierId, 'quoteRequests', requestId, 'references'), orderBy('createdAt', 'asc')));
  const references = await Promise.all(referenceSnapshots.docs.map(async (snapshot) => {
    const reference = { id: snapshot.id, ...snapshot.data() } as QuoteRequestReference;
    try { return { ...reference, downloadUrl: await getDownloadURL(ref(storage, reference.storagePath)) }; }
    catch { return { ...reference, downloadUrl: null }; }
  }));
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

export async function listClientQuotes(email: string) {
  if (!email.trim()) return [];
  const { db } = requireFirebase();
  const result = await getDocs(query(
    collectionGroup(db, 'quotes'),
    where('email', '==', email.trim().toLowerCase()),
    where('status', 'in', ['sent', 'approved', 'rejected', 'expired']),
    orderBy('createdAt', 'desc'),
    limit(50),
  ));
  return result.docs.map((snapshot) => ({ id: snapshot.id, atelierId: String(snapshot.data().atelierId), ...snapshot.data() } as Quote));
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
