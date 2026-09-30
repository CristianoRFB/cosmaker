'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, FileText, Mail, Phone, Ruler, Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAtelierQuoteRequest } from '@/features/quotes/use-quote-workspace';
import { categoryLabel, formatDate, formatMoney, formatTimestamp, requestStatusLabel } from '@/features/quotes/quote-format';

export default function QuoteRequestDetailPage() {
  const params = useParams<{ solicitacaoId: string }>();
  const { record, loading, error } = useAtelierQuoteRequest(params.solicitacaoId);

  if (loading) return <div className="grid gap-4"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;
  if (error) return <EmptyState description={error} title="Não foi possível abrir a solicitação" action={<Link className="font-semibold text-violet-700" href="/atelier/solicitacoes">Voltar às solicitações</Link>} />;
  if (!record) return <EmptyState description="A solicitação pode ter sido removida ou você não tem permissão para consultá-la." title="Solicitação não encontrada" action={<Link className="font-semibold text-violet-700" href="/atelier/solicitacoes">Voltar às solicitações</Link>} />;

  const { request, references } = record;
  const canDraft = !['approved', 'rejected', 'expired'].includes(request.status);
  const draftHref = `/atelier/orcamentos/novo?solicitacaoId=${encodeURIComponent(request.id)}`;

  return <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
    <div className="grid content-start gap-5">
      <div className="flex flex-wrap items-center gap-3"><Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700" href="/atelier/solicitacoes"><ArrowLeft size={16} />Solicitações</Link><Badge tone={request.status === 'new' || request.status === 'adjustment_requested' ? 'amber' : request.status === 'approved' ? 'green' : 'violet'}>{requestStatusLabel[request.status]}</Badge>{request.urgency === 'urgent' ? <Badge tone="pink">Prazo urgente</Badge> : null}</div>
      <Card className="p-5 sm:p-7"><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-700">Projeto solicitado</p><h2 className="mt-2 text-2xl font-bold tracking-tight">{request.character}</h2><p className="mt-1 text-sm text-slate-600">{request.franchise} <span className="px-1 text-slate-300">·</span> {categoryLabel[request.category] ?? request.category}</p><p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-700">{request.description}</p><div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2"><Info label="Recebida" value={formatTimestamp(request.createdAt)} /><Info icon={<CalendarDays size={15} />} label="Entrega desejada" value={formatDate(request.desiredDeliveryDate)} /><Info label="Evento" value={formatDate(request.eventDate)} />{request.budgetMin !== undefined || request.budgetMax !== undefined ? <Info label="Faixa informada" value={`${request.budgetMin !== undefined ? formatMoney(request.budgetMin) : 'Sem mínimo'} — ${request.budgetMax !== undefined ? formatMoney(request.budgetMax) : 'Sem máximo'}`} /> : null}</div>{request.observations ? <div className="mt-5 rounded-xl bg-violet-50 p-4"><p className="text-xs font-semibold text-violet-900">Observações do cliente</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{request.observations}</p></div> : null}</Card>

      <Card className="p-5 sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-700">Referências</p><h2 className="mt-1 text-lg font-semibold">Imagens do projeto</h2></div><span className="grid size-10 place-items-center rounded-xl bg-violet-100 text-violet-700"><Sparkles size={18} /></span></div>{references.length ? <ul className="mt-4 grid gap-2 sm:grid-cols-2">{references.map((reference) => <li className="rounded-xl border border-slate-100 p-3" key={reference.id}><p className="truncate text-sm font-medium text-slate-800">{reference.originalName}</p><p className="mt-1 text-xs text-slate-500">{(reference.size / 1024 / 1024).toFixed(1)} MB <span className="px-1">·</span> {reference.contentType}</p>{reference.downloadUrl ? <a className="mt-2 inline-flex text-xs font-semibold text-violet-700 hover:text-violet-900" href={reference.downloadUrl} rel="noreferrer" target="_blank">Abrir referência</a> : <p className="mt-2 text-xs text-amber-700">Arquivo indisponível</p>}</li>)}</ul> : <p className="mt-4 text-sm text-slate-500">O cliente não anexou imagens.</p>}</Card>
    </div>

    <aside className="grid content-start gap-4">
      <Card className="p-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-700">Contato</p><h2 className="mt-2 text-lg font-semibold">{request.name}</h2><a className="mt-4 flex items-center gap-2 break-all text-sm text-slate-600 hover:text-violet-700" href={`mailto:${request.email}`}><Mail size={16} />{request.email}</a>{request.phone ? <a className="mt-3 flex items-center gap-2 text-sm text-slate-600 hover:text-violet-700" href={`tel:${request.phone}`}><Phone size={16} />{request.phone}</a> : <p className="mt-3 text-sm text-slate-500">Telefone não informado</p>}</Card>
      <Card className="bg-gradient-to-br from-violet-900 to-fuchsia-800 p-5 text-white"><FileText size={20} /><h2 className="mt-3 font-semibold">Próxima etapa</h2><p className="mt-2 text-sm leading-6 text-violet-100">Monte os itens, custos, validade e previsão de entrega antes de disponibilizar a proposta ao cliente.</p>{canDraft ? <Link className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-violet-900 hover:bg-violet-50" href={draftHref}>{request.activeQuoteId ? 'Criar nova versão' : 'Criar orçamento'}<ArrowRight size={16} /></Link> : <p className="mt-4 text-sm text-violet-100">Esta solicitação foi encerrada e não aceita um novo orçamento.</p>}</Card>
      {request.activeQuoteId ? <Link className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white p-4 text-sm font-semibold text-violet-800 hover:bg-violet-50" href={`/atelier/orcamentos/${encodeURIComponent(request.activeQuoteId)}`}><Ruler size={16} />Abrir última proposta<ArrowRight className="ml-auto" size={15} /></Link> : null}
    </aside>
  </section>;
}

function Info({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return <div><p className="text-xs font-medium text-slate-500">{icon ? <span className="mr-1 inline-flex align-middle">{icon}</span> : null}{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value}</p></div>;
}
