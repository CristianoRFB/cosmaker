'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getQuote, getClientQuote, getQuoteRequest, listClientQuotes, listQuoteRequests, listQuotes } from '@/repositories/quotes.repository';
import type { QuoteDetailRecord } from '@/repositories/quotes.repository';
import { useAuth } from '@/providers/auth-provider';
import { useTenant } from '@/providers/tenant-provider';
import type { Quote } from '@/types/quote';
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
  const { firebaseUser } = useAuth();
  const identity = `${firebaseUser?.uid ?? ''}:${firebaseUser?.email ?? ''}:${firebaseUser?.emailVerified === true}`;
  const verified = firebaseUser?.emailVerified === true;
  const [state, setState] = useState<{ identity: string; quotes: Quote[]; cursor: string | null }>({ identity: '', quotes: [], cursor: null });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const epoch = useRef(0);
  useEffect(() => {
    const current = ++epoch.current;
    setState({ identity, quotes: [], cursor: null }); setError(''); setLoadingMore(false);
    if (!firebaseUser?.uid || !verified) { setLoading(false); return; }
    setLoading(true);
    listClientQuotes().then((result) => { if (epoch.current === current) setState({ identity, quotes: result.quotes, cursor: result.nextCursor }); })
      .catch((reason) => { if (epoch.current === current) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar seus orçamentos.'); })
      .finally(() => { if (epoch.current === current) setLoading(false); });
    return () => { epoch.current = current + 1; };
  }, [identity, verified, firebaseUser?.uid, revision]);
  const loadMore = async () => {
    if (state.identity !== identity || !state.cursor || loadingMore) return;
    const current = epoch.current; setLoadingMore(true); setError('');
    try {
      const result = await listClientQuotes(state.cursor);
      if (epoch.current === current) setState((previous) => ({ identity, quotes: [...new Map([...previous.quotes, ...result.quotes].map((quote) => [`${quote.atelierId}/${quote.id}`, quote])).values()], cursor: result.nextCursor }));
    } catch (reason) { if (epoch.current === current) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar mais propostas.'); }
    finally { if (epoch.current === current) setLoadingMore(false); }
  };
  return { quotes: state.identity === identity ? state.quotes : [], hasMore: state.identity === identity && !!state.cursor, loading, loadingMore, error, loadMore, reload: () => setRevision((value) => value + 1) };
}

export function useQuoteDetail(atelierId: string, quoteId: string, viewer: 'atelier' | 'client' = 'atelier') {
  const { firebaseUser } = useAuth();
  const identity = `${firebaseUser?.uid ?? ''}:${firebaseUser?.emailVerified === true}:${atelierId}:${quoteId}:${viewer}`;
  const [state, setState] = useState<{ identity: string; record: QuoteDetailRecord | null }>({ identity: '', record: null });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const epoch = useRef(0);
  useEffect(() => {
    const current = ++epoch.current;
    setState({ identity, record: null }); setError(''); setLoadingMore(false);
    if (!firebaseUser?.uid || !atelierId || !quoteId) { setError('O ateliê deste orçamento não foi informado.'); setLoading(false); return; }
    setLoading(true);
    (viewer === 'client' ? getClientQuote(atelierId, quoteId) : getQuote(atelierId, quoteId))
      .then((record) => { if (epoch.current === current) setState({ identity, record }); })
      .catch((reason) => { if (epoch.current === current) setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o orçamento.'); })
      .finally(() => { if (epoch.current === current) setLoading(false); });
    return () => { epoch.current = current + 1; };
  }, [identity, atelierId, quoteId, viewer, firebaseUser?.uid, revision]);
  const loadMoreResponses = async () => {
    if (viewer !== 'client' || state.identity !== identity || !state.record?.nextResponsesCursor || loadingMore) return;
    const current = epoch.current; setLoadingMore(true); setError('');
    try {
      const result = await getClientQuote(atelierId, quoteId, state.record.nextResponsesCursor);
      if (epoch.current === current) setState((previous) => ({ identity, record: { ...result, responses: [...new Map([...(previous.record?.responses ?? []), ...result.responses].map((response) => [response.id, response])).values()] } }));
    } catch (reason) { if (epoch.current === current) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o histórico.'); }
    finally { if (epoch.current === current) setLoadingMore(false); }
  };
  return { record: state.identity === identity ? state.record : null, loading, loadingMore, error, loadMoreResponses, reload: () => setRevision((value) => value + 1) };
}
