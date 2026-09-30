'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, ClipboardList, RefreshCw, Search, Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAtelierQuoteRequests } from '@/features/quotes/use-quote-workspace';
import { categoryLabel, formatDate, formatTimestamp, requestStatusLabel } from '@/features/quotes/quote-format';

const filterOptions = [
  { id: 'all', label: 'Todas' }, { id: 'new', label: 'Novas' }, { id: 'under_review', label: 'Em análise' }, { id: 'adjustment_requested', label: 'Ajustes' },
] as const;

export default function QuoteRequestsPage() {
  const { requests, loading, error, reload } = useAtelierQuoteRequests();
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => requests.filter((request) => {
    const matchesStatus = filter === 'all' || request.status === filter;
    const text = `${request.character} ${request.franchise} ${request.name} ${request.email}`.toLocaleLowerCase('pt-BR');
    return matchesStatus && text.includes(search.trim().toLocaleLowerCase('pt-BR'));
  }), [requests, filter, search]);
  const needsAttention = requests.filter((request) => request.status === 'new' || request.status === 'adjustment_requested').length;

  return <section className="grid gap-6">
    <div className="grid gap-4 sm:grid-cols-3">
      <Metric label="Solicitações recebidas" value={loading ? '—' : String(requests.length)} icon={<ClipboardList size={18} />} tone="violet" />
      <Metric label="Precisam de atenção" value={loading ? '—' : String(needsAttention)} icon={<Sparkles size={18} />} tone={needsAttention ? 'amber' : 'green'} />
      <Metric label="Em análise" value={loading ? '—' : String(requests.filter((request) => request.status === 'under_review').length)} icon={<CalendarDays size={18} />} tone="pink" />
    </div>

    <div className="grid gap-3 rounded-2xl border border-violet-100 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
      <div className="relative"><Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><Input aria-label="Buscar solicitações" className="pl-10" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar personagem, cliente ou e-mail" value={search} /></div>
      <Button onClick={() => void reload()} variant="secondary"><RefreshCw size={16} />Atualizar</Button>
      <div aria-label="Filtrar por status" className="flex gap-2 overflow-x-auto sm:col-span-2" role="group">{filterOptions.map((option) => <button aria-pressed={filter === option.id} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === option.id ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-violet-50'}`} key={option.id} onClick={() => setFilter(option.id)} type="button">{option.label}</button>)}</div>
    </div>

    {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert"><p>{error}</p><Button className="mt-3" onClick={() => void reload()} variant="secondary">Tentar novamente</Button></div> : null}
    {loading ? <div aria-label="Carregando solicitações" className="grid gap-3">{[0, 1, 2].map((item) => <Skeleton className="h-36 rounded-2xl" key={item} />)}</div> : null}
    {!loading && !error && filtered.length === 0 ? <EmptyState description={requests.length ? 'Ajuste a busca ou o filtro para encontrar outra solicitação.' : 'Quando um cliente enviar o formulário público, a solicitação aparecerá aqui para análise.'} icon={<ClipboardList size={21} />} title={requests.length ? 'Nenhum resultado para este filtro' : 'Nenhuma solicitação recebida'} /> : null}

    {!loading && filtered.length > 0 ? <div className="grid gap-3">{filtered.map((request) => {
      const statusTone = request.status === 'new' || request.status === 'adjustment_requested' ? 'amber' : request.status === 'approved' ? 'green' : request.status === 'rejected' ? 'red' : 'violet';
      return <article className="grid gap-4 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm transition hover:border-violet-200 hover:shadow-md sm:grid-cols-[1fr_auto] sm:items-center sm:p-5" key={request.id}>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-base font-semibold text-slate-950">{request.character}</h2><Badge tone={statusTone}>{requestStatusLabel[request.status] ?? 'Em análise'}</Badge>{request.urgency === 'urgent' ? <Badge tone="pink">Prazo urgente</Badge> : null}</div><p className="mt-1 text-sm text-slate-600">{request.franchise} <span className="px-1 text-slate-300">·</span> {categoryLabel[request.category] ?? request.category}</p><p className="mt-3 text-sm font-medium text-slate-800">{request.name} <span className="font-normal text-slate-500">{request.email}</span></p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>Recebida {formatTimestamp(request.createdAt)}</span><span>Entrega desejada {formatDate(request.desiredDeliveryDate)}</span></div></div>
        <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800" href={`/atelier/solicitacoes/${encodeURIComponent(request.id)}`}>Analisar <ArrowRight size={16} /></Link>
      </article>;
    })}</div> : null}
  </section>;
}

function Metric({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: 'violet' | 'amber' | 'pink' | 'green' }) {
  const toneClass = tone === 'amber' ? 'bg-amber-100 text-amber-800' : tone === 'pink' ? 'bg-pink-100 text-pink-800' : tone === 'green' ? 'bg-emerald-100 text-emerald-800' : 'bg-violet-100 text-violet-800';
  return <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">{label}</p><span className={`grid size-9 place-items-center rounded-xl ${toneClass}`}>{icon}</span></div><p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</p></div>;
}
