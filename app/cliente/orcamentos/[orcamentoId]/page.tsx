'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, CalendarDays, Check, Clock3, MessageSquareText, X } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { formatDate, formatMoney, formatTimestamp, itemCategoryLabel, quoteStatusLabel } from '@/features/quotes/quote-format';
import { useAuth } from '@/providers/auth-provider';
import { useQuoteDetail } from '@/features/quotes/use-quote-workspace';
import { respondToQuote } from '@/repositories/quotes.repository';

export default function ClientQuoteDetailPage() {
  const params = useParams<{ orcamentoId: string }>();
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [atelierId, setAtelierId] = useState('');
  const [comment, setComment] = useState('');
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { record, loading, error: loadError } = useQuoteDetail(atelierId, params.orcamentoId);

  useEffect(() => { setAtelierId(new URLSearchParams(window.location.search).get('atelierId') ?? ''); }, []);

  async function respond(choice: 'approved' | 'rejected' | 'request_changes') {
    if (!record) return;
    setPending(true); setError(''); setSuccess('');
    try {
      await respondToQuote(record.quote.atelierId, record.quote.id, choice, comment);
      setDecision(null);
      if (choice === 'request_changes') {
        setSuccess('Seu pedido de ajuste foi registrado e ficará no histórico do orçamento.');
        setComment('');
        router.refresh();
      } else {
        setSuccess(choice === 'approved' ? 'Orçamento aprovado. O pedido está sendo criado.' : 'Orçamento recusado. Sua resposta foi registrada.');
        window.setTimeout(() => window.location.reload(), 500);
      }
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : 'Não foi possível registrar sua resposta.');
    } finally { setPending(false); }
  }

  function requestChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (comment.trim().length < 5) { setError('Conte ao ateliê o que você gostaria de ajustar.'); return; }
    void respond('request_changes');
  }

  if (loading) return <div className="grid gap-4"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div>;
  if (loadError || !record) return <EmptyState description={loadError || (atelierId ? 'Este orçamento não existe, não está disponível para este e-mail ou você não tem acesso.' : 'O link desta proposta não informa qual ateliê a criou. Volte à lista e abra novamente.')} title="Orçamento não encontrado" action={<Link className="font-semibold text-violet-700" href="/cliente/orcamentos"><ArrowLeft className="mr-1 inline" size={15} />Voltar aos orçamentos</Link>} />;

  const { quote, items, responses } = record;
  const canRespond = quote.status === 'sent' && firebaseUser?.emailVerified === true;
  return <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
    <div className="grid content-start gap-5">
      <div className="flex flex-wrap items-center gap-3"><Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700" href="/cliente/orcamentos"><ArrowLeft size={16} />Meus orçamentos</Link><Badge tone={quote.status === 'approved' ? 'green' : quote.status === 'rejected' ? 'red' : quote.status === 'sent' ? 'amber' : 'violet'}>{quoteStatusLabel[quote.status]}</Badge></div>
      {!firebaseUser?.emailVerified ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Confirme o e-mail da sua conta para consultar e responder a esta proposta. <Link className="font-semibold underline" href="/verificar-email">Verificar e-mail</Link></div> : null}
      <Card className="p-5 sm:p-7"><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-700">Orçamento do ateliê</p><h2 className="mt-2 text-2xl font-bold">Proposta de cosplay</h2><p className="mt-1 break-all text-sm text-slate-600">{quote.email}</p><div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3"><Info icon={<Clock3 size={15} />} label="Válido até" value={formatDate(quote.validUntil)} /><Info icon={<CalendarDays size={15} />} label="Previsão de início" value={formatDate(quote.expectedStartDate)} /><Info label="Previsão de conclusão" value={formatDate(quote.expectedCompletionDate)} /></div></Card>
      <Card className="p-5 sm:p-7"><h2 className="text-lg font-semibold">Itens e serviços</h2><div className="mt-4 divide-y divide-slate-100">{items.map((item) => <div className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:items-center" key={item.id}><div><p className="font-medium text-slate-900">{item.description}</p><p className="text-xs text-slate-500">{itemCategoryLabel[item.category]} · {item.quantity} × {formatMoney(item.unitPrice)}</p></div><p className="text-sm font-semibold text-slate-800">{formatMoney(item.total)}</p></div>)}</div>{!items.length ? <p className="mt-3 text-sm text-slate-500">O ateliê não adicionou itens detalhados a esta proposta.</p> : null}</Card>
      {responses.length ? <Card className="p-5 sm:p-7"><h2 className="text-lg font-semibold">Histórico de respostas</h2><ol className="mt-4 grid gap-3">{responses.map((response) => <li className="rounded-xl bg-slate-50 p-4" key={response.id}><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold">{response.decision === 'approved' ? 'Orçamento aprovado' : response.decision === 'rejected' ? 'Orçamento recusado' : 'Ajuste solicitado'}</p><time className="text-xs text-slate-500">{formatTimestamp(response.createdAt)}</time></div>{typeof response.comment === 'string' && response.comment ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{response.comment}</p> : null}</li>)}</ol></Card> : null}
    </div>

    <aside className="grid content-start gap-4">
      <Card className="p-5"><h2 className="text-sm font-semibold text-slate-700">Investimento</h2><dl className="mt-4 grid gap-3 text-sm"><Row label="Materiais" value={formatMoney(quote.materialsCost)} /><Row label="Mão de obra" value={formatMoney(quote.laborCost)} />{quote.otherCost ? <Row label="Outros itens" value={formatMoney(quote.otherCost)} /> : null}<Row label="Urgência" value={formatMoney(quote.urgencyFee)} /><Row label="Frete" value={formatMoney(quote.shipping)} /><Row label="Desconto" value={`− ${formatMoney(quote.discount)}`} /><div className="border-t border-slate-100 pt-3"><Row bold label="Total" value={formatMoney(quote.total)} /></div><Row label={`Entrada (${quote.depositPercentage}%)`} value={formatMoney(quote.depositAmount)} /></dl></Card>
      {quote.status === 'approved' ? <Card className="bg-emerald-50 p-5"><h2 className="font-semibold text-emerald-950">Aprovação registrada</h2><p className="mt-2 text-sm leading-6 text-emerald-900">O ateliê está preparando o pedido usando os valores e itens preservados na aprovação.</p></Card> : null}
      {canRespond ? <Card className="p-5"><h2 className="font-semibold">O que você acha da proposta?</h2><p className="mt-2 text-sm leading-6 text-slate-600">Sua resposta ficará registrada no histórico. Se quiser mudar valores ou detalhes, peça um ajuste antes de aprovar.</p><div className="mt-4 grid gap-2"><Button onClick={() => setDecision('approved')}><Check size={16} />Aprovar proposta</Button><Button onClick={() => setDecision('rejected')} variant="secondary"><X size={16} />Recusar proposta</Button></div><form className="mt-5 grid gap-3 border-t border-slate-100 pt-4" onSubmit={requestChanges}><label className="grid gap-1.5 text-sm font-semibold text-slate-700" htmlFor="clientComment">Pedir um ajuste<Textarea id="clientComment" maxLength={1000} onChange={(event) => setComment(event.target.value)} placeholder="Conte o que gostaria de ajustar…" value={comment} /></label><Button disabled={pending || comment.trim().length < 5} type="submit" variant="secondary"><MessageSquareText size={16} />Enviar pedido de ajuste</Button></form></Card> : null}
      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p> : null}
      {success ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{success}</p> : null}
      <ConfirmDialog confirmLabel={pending ? 'Registrando…' : decision === 'approved' ? 'Aprovar orçamento' : 'Recusar orçamento'} description={decision === 'approved' ? `Ao aprovar, você confirma o valor total de ${formatMoney(quote.total)} e o ateliê iniciará a preparação do pedido.` : 'A recusa será registrada no histórico e não poderá ser desfeita nesta versão do orçamento.'} onClose={() => setDecision(null)} onConfirm={() => decision && void respond(decision)} open={decision !== null} title={decision === 'approved' ? 'Confirmar aprovação?' : 'Confirmar recusa?'} />
    </aside>
  </section>;
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return <div><p className="text-xs font-medium text-slate-500">{icon ? <span className="mr-1 inline-flex align-middle">{icon}</span> : null}{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value}</p></div>;
}
function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex items-center justify-between gap-3 ${bold ? 'text-base font-bold text-slate-950' : 'text-slate-600'}`}><dt>{label}</dt><dd>{value}</dd></div>;
}
