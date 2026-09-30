'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { quoteStatusLabel, formatDate, formatMoney, formatTimestamp, itemCategoryLabel } from '@/features/quotes/quote-format';
import { useAtelierQuoteRequest, useQuoteDetail } from '@/features/quotes/use-quote-workspace';
import { publishQuote } from '@/repositories/quotes.repository';
import { useTenant } from '@/providers/tenant-provider';

export default function AtelierQuoteDetailPage() {
  const params = useParams<{ orcamentoId: string }>();
  const router = useRouter();
  const { atelierId, membershipValid } = useTenant();
  const { record, loading, error } = useQuoteDetail(atelierId ?? '', params.orcamentoId);
  const request = useAtelierQuoteRequest(record?.quote.requestId ?? '');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState('');

  async function makeAvailable() {
    if (!atelierId || !membershipValid || !record) return;
    setPending(true); setActionError('');
    try {
      await publishQuote(atelierId, record.quote.id);
      setConfirmOpen(false);
      router.refresh();
      window.location.reload();
    } catch (publishError) {
      setActionError(publishError instanceof Error ? publishError.message : 'Não foi possível disponibilizar o orçamento.');
    } finally { setPending(false); }
  }

  if (loading) return <div className="grid gap-4"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div>;
  if (error || !record) return <EmptyState description={error || 'Este orçamento não existe ou você não tem acesso.'} title="Orçamento não encontrado" action={<Link className="font-semibold text-violet-700" href="/atelier/orcamentos">Voltar aos orçamentos</Link>} />;
  const { quote, items, responses } = record;
  const requestRecord = request.record?.request;

  return <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
    <div className="grid content-start gap-5">
      <div className="flex flex-wrap items-center gap-3"><Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700" href="/atelier/orcamentos"><ArrowLeft size={16} />Orçamentos</Link><Badge tone={quote.status === 'approved' ? 'green' : quote.status === 'rejected' ? 'red' : quote.status === 'sent' ? 'amber' : 'violet'}>{quoteStatusLabel[quote.status]}</Badge></div>
      <Card className="p-5 sm:p-7"><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-700">Proposta comercial</p><h2 className="mt-2 text-2xl font-bold">{requestRecord?.character ?? 'Projeto solicitado'}</h2><p className="mt-1 break-all text-sm text-slate-600">{quote.email}</p>{requestRecord ? <p className="mt-1 text-sm text-slate-600">{requestRecord.franchise} · {requestRecord.name}</p> : null}
        <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3"><Info label="Validade" value={formatDate(quote.validUntil)} /><Info icon={<CalendarDays size={15} />} label="Início previsto" value={formatDate(quote.expectedStartDate)} /><Info label="Conclusão prevista" value={formatDate(quote.expectedCompletionDate)} /></div>
      </Card>
      <Card className="p-5 sm:p-7"><h2 className="text-lg font-semibold">Itens incluídos</h2>{items.length ? <div className="mt-4 divide-y divide-slate-100">{items.map((item) => <div className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:items-center" key={item.id}><div><p className="font-medium text-slate-900">{item.description}</p><p className="text-xs text-slate-500">{itemCategoryLabel[item.category]} · {item.quantity} × {formatMoney(item.unitPrice)}</p></div><p className="text-sm font-semibold text-slate-800">{formatMoney(item.total)}</p></div>)}</div> : <p className="mt-3 text-sm text-slate-500">Nenhum item foi salvo neste orçamento.</p>}</Card>
      {responses.length ? <Card className="p-5 sm:p-7"><h2 className="text-lg font-semibold">Histórico de resposta do cliente</h2><ol className="mt-4 grid gap-3">{responses.map((response) => <li className="rounded-xl bg-slate-50 p-4" key={response.id}><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{response.decision === 'approved' ? 'Aprovou o orçamento' : response.decision === 'rejected' ? 'Recusou o orçamento' : 'Pediu um ajuste'}</p><time className="text-xs text-slate-500">{formatTimestamp(response.createdAt)}</time></div>{typeof response.comment === 'string' && response.comment ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{response.comment}</p> : null}</li>)}</ol></Card> : null}
    </div>

    <aside className="grid content-start gap-4">
      <Card className="p-5"><h2 className="text-sm font-semibold text-slate-700">Resumo financeiro</h2><dl className="mt-4 grid gap-3 text-sm"><Row label="Materiais" value={formatMoney(quote.materialsCost)} /><Row label="Mão de obra" value={formatMoney(quote.laborCost)} />{quote.otherCost ? <Row label="Outros itens" value={formatMoney(quote.otherCost)} /> : null}<Row label="Urgência e frete" value={formatMoney(quote.urgencyFee + quote.shipping)} /><Row label="Desconto" value={`− ${formatMoney(quote.discount)}`} /><div className="border-t border-slate-100 pt-3"><Row bold label="Total" value={formatMoney(quote.total)} /></div><Row label={`Entrada (${quote.depositPercentage}%)`} value={formatMoney(quote.depositAmount)} /></dl></Card>
      {quote.status === 'draft' ? <Card className="bg-violet-50 p-5"><h2 className="font-semibold text-violet-950">Rascunho salvo</h2><p className="mt-2 text-sm leading-6 text-violet-900">O cliente ainda não vê este orçamento. Ao disponibilizar, ele poderá consultá-lo na conta vinculada ao mesmo e-mail verificado.</p><p className="mt-2 text-xs leading-5 text-violet-800">Não há envio de e-mail externo configurado; avise o cliente pelo canal combinado.</p><Button className="mt-4 w-full" disabled={!membershipValid} onClick={() => setConfirmOpen(true)}><Check size={16} />Disponibilizar ao cliente</Button></Card> : null}
      {quote.status === 'sent' ? <Card className="bg-amber-50 p-5"><h2 className="font-semibold text-amber-950">Aguardando resposta</h2><p className="mt-2 text-sm leading-6 text-amber-900">O cliente pode aprovar, recusar ou pedir ajuste ao entrar com o e-mail verificado desta proposta.</p><p className="mt-2 text-xs text-amber-800">Para alterar valores, crie uma nova versão. A versão já disponibilizada permanece no histórico.</p></Card> : null}
      {quote.status === 'approved' ? <Card className="bg-emerald-50 p-5"><h2 className="font-semibold text-emerald-950">Proposta aprovada</h2><p className="mt-2 text-sm leading-6 text-emerald-900">O backend cria um pedido com o snapshot de preço aprovado e o coloca em aguardando sinal.</p></Card> : null}
      {['rejected', 'expired', 'superseded'].includes(quote.status) ? <Card className="p-5"><p className="text-sm text-slate-600">Esta versão está encerrada. Se a solicitação permitir, crie uma nova proposta a partir do pedido original.</p></Card> : null}
      {quote.status !== 'approved' && requestRecord && !['rejected', 'expired'].includes(requestRecord.status) ? <Link className="inline-flex items-center justify-between gap-2 rounded-xl border border-violet-200 bg-white p-4 text-sm font-semibold text-violet-800 hover:bg-violet-50" href={`/atelier/orcamentos/novo?solicitacaoId=${encodeURIComponent(quote.requestId)}`}><span className="inline-flex items-center gap-2"><RefreshCw size={16} />Criar nova versão</span><ArrowRight size={15} /></Link> : null}
      {actionError ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert">{actionError}</p> : null}
      <ConfirmDialog confirmLabel={pending ? 'Aguarde…' : 'Disponibilizar'} description={`O cliente ${quote.email} poderá consultar esta proposta no portal quando entrar com esse e-mail verificado. Você ainda precisará avisá-lo por um canal combinado.`} onClose={() => setConfirmOpen(false)} onConfirm={() => void makeAvailable()} open={confirmOpen} title="Disponibilizar orçamento?" />
      {request.loading ? <span className="sr-only">Carregando solicitação</span> : null}
    </aside>
  </section>;
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return <div><p className="text-xs font-medium text-slate-500">{icon ? <span className="mr-1 inline-flex align-middle">{icon}</span> : null}{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value}</p></div>;
}
function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex items-center justify-between gap-3 ${bold ? 'text-base font-bold text-slate-950' : 'text-slate-600'}`}><dt>{label}</dt><dd>{value}</dd></div>;
}
