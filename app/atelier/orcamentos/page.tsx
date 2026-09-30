'use client';

import Link from 'next/link';
import { ArrowRight, FileText, Plus, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAtelierQuotes } from '@/features/quotes/use-quote-workspace';
import { formatDate, formatMoney, quoteStatusLabel } from '@/features/quotes/quote-format';

export default function AtelierQuotesPage() {
  const { quotes, loading, error, reload } = useAtelierQuotes();
  const drafts = quotes.filter((quote) => quote.status === 'draft').length;
  const awaitingCustomer = quotes.filter((quote) => quote.status === 'sent').length;

  return <section className="grid gap-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Propostas" value={loading ? '—' : String(quotes.length)} />
      <Metric label="Rascunhos" value={loading ? '—' : String(drafts)} />
      <Metric label="Aguardando cliente" value={loading ? '—' : String(awaitingCustomer)} />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-white p-4"><div><h2 className="font-semibold">Orçamentos do ateliê</h2><p className="mt-1 text-sm text-slate-500">Propostas ligadas às solicitações recebidas.</p></div><div className="flex gap-2"><Button onClick={() => void reload()} variant="secondary"><RefreshCw size={16} />Atualizar</Button><Link className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white hover:bg-violet-800" href="/atelier/solicitacoes"><Plus size={16} />Usar solicitação</Link></div></div>
    {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}<Button className="ml-3" onClick={() => void reload()} variant="secondary">Tentar novamente</Button></div> : null}
    {loading ? <div className="grid gap-3">{[0, 1, 2].map((item) => <Skeleton className="h-28 rounded-2xl" key={item} />)}</div> : null}
    {!loading && !error && quotes.length === 0 ? <EmptyState description="Crie uma proposta a partir dos detalhes de uma solicitação. O rascunho será salvo com acesso restrito ao ateliê." icon={<FileText size={21} />} title="Nenhum orçamento criado" action={<Link className="font-semibold text-violet-700" href="/atelier/solicitacoes">Ver solicitações</Link>} /> : null}
    {!loading && quotes.length > 0 ? <div className="grid gap-3">{quotes.map((quote) => <Link className="grid gap-4 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm transition hover:border-violet-200 hover:shadow-md sm:grid-cols-[1fr_auto] sm:items-center sm:p-5" href={`/atelier/orcamentos/${encodeURIComponent(quote.id)}`} key={quote.id}><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{formatMoney(quote.total)}</h3><Badge tone={quote.status === 'approved' ? 'green' : quote.status === 'rejected' ? 'red' : quote.status === 'sent' ? 'amber' : 'violet'}>{quoteStatusLabel[quote.status]}</Badge></div><p className="mt-1 break-all text-sm text-slate-600">{quote.email}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>Entrega prevista {formatDate(quote.expectedCompletionDate)}</span><span>Válido até {formatDate(quote.validUntil)}</span><span>Entrada {formatMoney(quote.depositAmount)} ({quote.depositPercentage}%)</span></div></div><span className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700">Abrir <ArrowRight size={16} /></span></Link>)}</div> : null}
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-violet-100 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p></div>;
}
