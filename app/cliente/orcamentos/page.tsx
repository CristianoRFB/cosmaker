'use client';

import Link from 'next/link';
import { ArrowRight, FileText } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/providers/auth-provider';
import { useClientQuotes } from '@/features/quotes/use-quote-workspace';
import { formatDate, formatMoney, quoteStatusLabel } from '@/features/quotes/quote-format';

export default function ClientQuotesPage() {
  const { firebaseUser } = useAuth();
  const { quotes, loading, error } = useClientQuotes();
  const needsAnswer = quotes.filter((quote) => quote.status === 'sent').length;

  return <section className="grid gap-5">
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="text-sm text-slate-500">Propostas para seu e-mail</p><h2 className="mt-1 text-2xl font-bold text-slate-950">{loading ? '—' : quotes.length}</h2></div><div className="rounded-xl bg-violet-50 px-4 py-3 text-sm"><span className="font-semibold text-violet-900">{loading ? '—' : needsAnswer}</span><span className="ml-2 text-violet-800">aguardando sua resposta</span></div></Card>
    {firebaseUser?.emailVerified !== true ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Confirme o e-mail da sua conta para consultar propostas. <Link className="font-semibold underline" href="/verificar-email">Ir para verificação</Link></div> : null}
    {error && firebaseUser?.emailVerified === true ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</div> : null}
    {loading ? <div className="grid gap-3">{[0, 1].map((item) => <Skeleton className="h-32 rounded-2xl" key={item} />)}</div> : null}
    {!loading && !error && firebaseUser?.emailVerified && quotes.length === 0 ? <EmptyState description="Quando um ateliê disponibilizar uma proposta para o e-mail verificado da sua conta, ela aparecerá aqui." icon={<FileText size={21} />} title="Nenhum orçamento disponível" /> : null}
    {!loading && quotes.length > 0 ? <div className="grid gap-3">{quotes.map((quote) => <Link className="grid gap-4 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm transition hover:border-violet-200 hover:shadow-md sm:grid-cols-[1fr_auto] sm:items-center sm:p-5" href={`/cliente/orcamentos/${encodeURIComponent(quote.id)}?atelierId=${encodeURIComponent(quote.atelierId)}`} key={`${quote.atelierId}-${quote.id}`}><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-slate-950">{formatMoney(quote.total)}</h3><Badge tone={quote.status === 'approved' ? 'green' : quote.status === 'rejected' ? 'red' : quote.status === 'sent' ? 'amber' : 'violet'}>{quoteStatusLabel[quote.status]}</Badge></div><p className="mt-1 text-sm text-slate-600">Válido até {formatDate(quote.validUntil)}</p><p className="mt-2 text-xs text-slate-500">Entrada {formatMoney(quote.depositAmount)} · prazo de entrega previsto {formatDate(quote.expectedCompletionDate)}</p></div><span className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700">Ver proposta<ArrowRight size={16} /></span></Link>)}</div> : null}
  </section>;
}
