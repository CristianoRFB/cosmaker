'use client';

import { useCallback, useEffect, useState } from 'react';
import { getQuote, getQuoteRequest, listClientQuotes, listQuoteRequests, listQuotes } from '@/repositories/quotes.repository';
import { useAuth } from '@/providers/auth-provider';
import { useTenant } from '@/providers/tenant-provider';
import type { Quote, QuoteItem, QuoteResponse } from '@/types/quote';
import type { QuoteRequest, QuoteRequestReference } from '@/types/quote-request';

export function useAtelierQuoteRequests() {
  const { atelierId, membershipValid } = useTenant();
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!atelierId || !membershipValid) { setRequests([]); setLoading(false); return; }
    setLoading(true); setError('');
    try { setRequests(await listQuoteRequests(atelierId)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as solicitações.'); }
    finally { setLoading(false); }
  }, [atelierId, membershipValid]);
  useEffect(() => { void reload(); }, [reload]);
  return { requests, loading, error, reload };
}

export function useAtelierQuoteRequest(requestId: string) {
  const { atelierId, membershipValid } = useTenant();
  const [record, setRecord] = useState<{ request: QuoteRequest; references: QuoteRequestReference[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (!atelierId || !membershipValid || !requestId) { setRecord(null); setLoading(false); return; }
    setLoading(true); setError('');
    getQuoteRequest(atelierId, requestId).then((result) => { if (active) setRecord(result); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível abrir a solicitação.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [atelierId, membershipValid, requestId]);
  return { atelierId, record, loading, error };
}

export function useAtelierQuotes() {
  const { atelierId, membershipValid } = useTenant();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!atelierId || !membershipValid) { setQuotes([]); setLoading(false); return; }
    setLoading(true); setError('');
    try { setQuotes(await listQuotes(atelierId)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os orçamentos.'); }
    finally { setLoading(false); }
  }, [atelierId, membershipValid]);
  useEffect(() => { void reload(); }, [reload]);
  return { atelierId, quotes, loading, error, reload };
}

export function useClientQuotes() {
  const { user, firebaseUser } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (!user?.email) { setQuotes([]); setLoading(false); return; }
    if (firebaseUser?.emailVerified !== true) { setQuotes([]); setError('Confirme seu e-mail para consultar os orçamentos associados ao endereço da sua conta.'); setLoading(false); return; }
    setLoading(true); setError('');
    listClientQuotes(user.email).then((result) => { if (active) setQuotes(result); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar seus orçamentos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.email, firebaseUser?.emailVerified]);
  return { quotes, loading, error };
}

export function useQuoteDetail(atelierId: string, quoteId: string) {
  const [record, setRecord] = useState<{ quote: Quote; items: QuoteItem[]; responses: QuoteResponse[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (!atelierId || !quoteId) { setRecord(null); setError('O ateliê deste orçamento não foi informado.'); setLoading(false); return; }
    setLoading(true); setError('');
    getQuote(atelierId, quoteId).then((result) => { if (active) setRecord(result); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível abrir o orçamento.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [atelierId, quoteId]);
  return { record, loading, error };
}
