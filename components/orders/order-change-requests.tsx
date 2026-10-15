'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { FilePenLine, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/use-auth';
import { applyOrderChangeRequest, cancelOrderChangeRequest, listOrderChangeRequests, proposeOrderChangeRequest, respondToOrderChangeRequest } from '@/repositories/order-change.repository';
import { formatOrderDate, formatOrderMoney } from '@/features/orders/order-format';
import type { Order } from '@/types/order';
import type { OrderChangeRequest, OrderChangeRequestPage, OrderChangeStatus, OrderChangeTerms } from '@/types/order-change';

const statusLabels: Record<OrderChangeStatus, string> = { pending: 'Aguardando cliente', approved: 'Aprovada, aguardando aplicação', rejected: 'Recusada', changes_requested: 'Ajustes solicitados', cancelled: 'Cancelada', applied: 'Aplicada' };
const labelClass = 'grid gap-1.5 text-sm font-medium text-slate-700';
const initialDraft = { reason: '', scope: '', materials: '', expectedDeliveryDate: '', valueDelta: '0', useScope: false, useMaterials: false, useDate: false, useValue: false };

function AgreementComparison({ request }: { request: OrderChangeRequest }) {
  const before = request.baseAgreementSnapshot;
  const after = request.proposedAgreementSnapshot;
  const values = [
    ['Escopo', before.scope, after.scope], ['Materiais acordados', before.materials || 'Sem descrição adicional', after.materials || 'Sem descrição adicional'],
    ['Entrega', formatOrderDate(before.expectedDeliveryDate), formatOrderDate(after.expectedDeliveryDate)],
    ['Total', formatOrderMoney(before.totalCents / 100), formatOrderMoney(after.totalCents / 100)],
  ];
  return <div className="mt-3 grid gap-3">{values.map(([name, oldValue, newValue]) => <div className="rounded-xl bg-white p-3" key={name}>
    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{name}</h4>
    <div className="mt-2 grid gap-2 sm:grid-cols-2"><div><p className="text-xs text-slate-500">Acordo base v{before.version}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{oldValue}</p></div><div><p className="text-xs font-medium text-violet-700">Revisão proposta</p><p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-slate-900">{newValue}</p></div></div>
  </div>)}<p className="text-xs text-slate-600">Entrada original preservada: {formatOrderMoney(after.depositAmountCents / 100)}. A aprovação desta revisão registra o acordo; recebimentos continuam sujeitos à confirmação financeira manual.</p></div>;
}

export function OrderChangeRequests({ order, clientView = false, reload }: { order: Order; clientView?: boolean; reload?: () => Promise<void> }) {
  const { user } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState<OrderChangeRequestPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [draft, setDraft] = useState(initialDraft);
  const [supersedesId, setSupersedesId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const operationIds = useRef(new Map<string, string>());
  const mountedRevision = useRef(0);
  const privileged = user?.role === 'owner' || user?.role === 'admin';
  const canManage = !clientView && (privileged || user?.permissions.includes('orders:manage'));
  const canFinance = privileged || user?.permissions.includes('payments:write') || user?.permissions.includes('finance:write');
  const closed = ['cancelled', 'refunded', 'shipped', 'delivered', 'completed'].includes(order.status);

  function requestId(key: string) {
    if (!operationIds.current.has(key)) operationIds.current.set(key, crypto.randomUUID());
    return operationIds.current.get(key)!;
  }

  const refresh = useCallback(async () => {
    const revision = ++mountedRevision.current;
    setLoading(true);
    try {
      const result = await listOrderChangeRequests(order.atelierId, order.id);
      if (mountedRevision.current === revision) { setPage(result); setError(''); }
    } catch (failure) {
      if (mountedRevision.current === revision) setError(failure instanceof Error ? failure.message : 'Não foi possível carregar os acordos.');
    } finally { if (mountedRevision.current === revision) setLoading(false); }
  }, [order.atelierId, order.id]);

  useEffect(() => {
    const revisionCounter = mountedRevision;
    setPage(null); setDraft(initialDraft); setShowForm(false); setSupersedesId(''); setComments({}); setConfirmed({});
    setLoadingMore(false); operationIds.current.clear(); void refresh();
    return () => { revisionCounter.current++; };
  }, [refresh]);

  async function loadMore() {
    if (!page?.nextCursor || loadingMore) return;
    const revision = mountedRevision.current;
    setLoadingMore(true);
    try {
      const result = await listOrderChangeRequests(order.atelierId, order.id, page.nextCursor);
      if (revision !== mountedRevision.current) return;
      setPage((current) => current ? { ...result, requests: [...current.requests, ...result.requests.filter((request) => !current.requests.some((previous) => previous.id === request.id))] } : result);
      setError('');
    } catch (failure) { if (revision === mountedRevision.current) setError(failure instanceof Error ? failure.message : 'Não foi possível carregar mais revisões.'); }
    finally { if (revision === mountedRevision.current) setLoadingMore(false); }
  }

  async function act(key: string, action: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(key);
    setError('');
    try {
      await action();
      toast(message, 'success');
      await refresh();
      await reload?.();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível registrar a ação.'); }
    finally { setBusy(''); }
  }

  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!page || busy) return;
    const changes: OrderChangeTerms = {};
    if (draft.useScope) changes.scope = draft.scope.trim();
    if (draft.useMaterials) changes.materials = draft.materials.trim();
    if (draft.useDate) changes.expectedDeliveryDate = draft.expectedDeliveryDate;
    if (draft.useValue) {
      if (!/^-?\d{1,12}(?:[.,]\d{1,2})?$/.test(draft.valueDelta.trim())) { setError('Informe a variação de valor com até duas casas decimais. Use sinal negativo para redução.'); return; }
      changes.valueDeltaCents = Math.round(Number(draft.valueDelta.replace(',', '.')) * 100);
    }
    const input = { atelierId: order.atelierId, orderId: order.id, baseAgreementVersion: page.currentAgreement.version,
      baseAgreementFingerprint: page.currentAgreementFingerprint, reason: draft.reason.trim(), changes,
      ...(supersedesId ? { supersedesId } : {}) };
    const key = JSON.stringify(input);
    await act('propose', async () => {
      await proposeOrderChangeRequest({ ...input, requestId: requestId(`propose:${key}`) });
      setDraft(initialDraft); setSupersedesId(''); setShowForm(false);
    }, 'Revisão enviada para aprovação do cliente.');
  }

  async function respond(request: OrderChangeRequest, decision: 'approved' | 'rejected' | 'changes_requested') {
    const comment = comments[request.id] ?? '';
    const accepted = confirmed[request.id] === true;
    const key = `respond:${request.id}:${decision}:${comment}:${accepted}`;
    await act(request.id, () => respondToOrderChangeRequest({ atelierId: order.atelierId, orderId: order.id, changeRequestId: request.id,
      requestId: requestId(key), version: request.version, proposalFingerprint: request.proposalFingerprint, decision, comment, confirmed: accepted }),
    decision === 'approved' ? 'Acordo aprovado e registrado. O ateliê aplicará esta revisão.' : decision === 'rejected' ? 'Revisão recusada. O acordo vigente foi preservado.' : 'Ajustes solicitados. O ateliê pode emitir uma nova revisão.');
  }

  function openRevision(request?: OrderChangeRequest) {
    setSupersedesId(request?.id ?? '');
    setDraft({ ...initialDraft, reason: request ? `Revisão da proposta ${request.version}: ` : '', scope: page?.currentAgreement.scope ?? '', materials: page?.currentAgreement.materials ?? '', expectedDeliveryDate: page?.currentAgreement.expectedDeliveryDate ?? '' });
    setShowForm(true);
  }

  return <Card>
    <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><FilePenLine className="text-violet-700" size={19} />Revisões do acordo</CardTitle><Button disabled={loading || !!busy} onClick={() => void refresh()} variant="secondary"><RefreshCw size={15} />Atualizar revisões</Button></div><p className="text-sm leading-6 text-slate-600">Cada mudança de escopo, materiais, prazo ou valor recebe uma versão e exige aprovação explícita do cliente antes de ser aplicada.</p></CardHeader>
    <CardContent className="grid gap-4">
      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p> : null}
      {loading && !page ? <p className="text-sm text-slate-600" role="status">Carregando revisões do pedido…</p> : null}
      {page ? <div className="rounded-xl border border-violet-100 bg-violet-50 p-4"><p className="font-semibold text-slate-900">Acordo vigente v{page.currentAgreement.version} · {formatOrderMoney(page.currentAgreement.totalCents / 100)}</p><p className="mt-1 text-sm text-slate-600">Entrega acordada: {formatOrderDate(page.currentAgreement.expectedDeliveryDate)}. A proposta original aprovada continua preservada no pedido.</p></div> : null}
      {canManage && !closed && page && !showForm ? <Button className="justify-self-start" disabled={!!busy} onClick={() => openRevision()}>Propor alteração do acordo</Button> : null}
      {showForm && canManage && page ? <form className="grid gap-4 rounded-2xl border border-violet-200 p-4" onSubmit={(event) => void propose(event)}>
        <h3 className="font-semibold text-slate-900">{supersedesId ? 'Nova revisão das condições' : 'Nova proposta de alteração'}</h3>
        <label className={labelClass}>Motivo da alteração<Textarea maxLength={1000} minLength={5} onChange={(event) => setDraft((value) => ({ ...value, reason: event.target.value }))} required value={draft.reason} /></label>
        <div className="grid gap-2"><label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700"><input checked={draft.useScope} onChange={(event) => setDraft((value) => ({ ...value, useScope: event.target.checked }))} type="checkbox" />Alterar escopo</label>{draft.useScope ? <label className={labelClass}>Novo escopo<Textarea maxLength={3000} minLength={5} onChange={(event) => setDraft((value) => ({ ...value, scope: event.target.value }))} required value={draft.scope} /></label> : null}</div>
        <div className="grid gap-2"><label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700"><input checked={draft.useMaterials} onChange={(event) => setDraft((value) => ({ ...value, useMaterials: event.target.checked }))} type="checkbox" />Alterar materiais acordados</label>{draft.useMaterials ? <label className={labelClass}>Nova descrição de materiais<Textarea maxLength={1500} onChange={(event) => setDraft((value) => ({ ...value, materials: event.target.value }))} required value={draft.materials} /></label> : null}<p className="text-xs text-slate-500">A descrição do acordo orienta a equipe; reservas e consumo continuam registrados no estoque.</p></div>
        <div className="grid gap-2"><label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700"><input checked={draft.useDate} onChange={(event) => setDraft((value) => ({ ...value, useDate: event.target.checked }))} type="checkbox" />Alterar prazo de entrega</label>{draft.useDate ? <label className={labelClass}>Nova data de entrega<Input onChange={(event) => setDraft((value) => ({ ...value, expectedDeliveryDate: event.target.value }))} required type="date" value={draft.expectedDeliveryDate} /></label> : null}</div>
        {canFinance ? <div className="grid gap-2"><label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700"><input checked={draft.useValue} onChange={(event) => setDraft((value) => ({ ...value, useValue: event.target.checked }))} type="checkbox" />Alterar valor total</label>{draft.useValue ? <label className={labelClass}>Variação de valor (R$)<Input inputMode="decimal" onChange={(event) => setDraft((value) => ({ ...value, valueDelta: event.target.value }))} placeholder="Ex.: 50,00 ou -25,00" required value={draft.valueDelta} /><span className="text-xs font-normal text-slate-500">Use valor positivo para acréscimo e negativo para redução. O total já pago e a entrada original precisam ser preservados.</span></label> : null}</div> : <p className="text-sm text-slate-600">Mudanças de valor exigem a permissão financeira.</p>}
        <div className="flex flex-wrap gap-2"><Button disabled={!!busy || ![draft.useScope, draft.useMaterials, draft.useDate, draft.useValue].some(Boolean)} type="submit">{busy === 'propose' ? 'Enviando…' : 'Enviar revisão para aprovação'}</Button><Button disabled={!!busy} onClick={() => setShowForm(false)} type="button" variant="secondary">Fechar proposta</Button></div>
      </form> : null}
      {page?.requests.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Este pedido ainda segue o acordo original, sem propostas de alteração.</p> : null}
      {page?.requests.map((request) => {
        const stale = request.baseAgreementVersion !== page.currentAgreement.version || request.baseAgreementFingerprint !== page.currentAgreementFingerprint;
        const actionable = !closed && !stale;
        const financial = (request.changes.valueDeltaCents ?? 0) !== 0;
        return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={request.id}>
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">Proposta de alteração v{request.version}</h3><Badge tone={request.status === 'applied' || request.status === 'approved' ? 'green' : request.status === 'pending' ? 'amber' : 'neutral'}>{statusLabels[request.status]}</Badge></div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{request.reason}</p>
          <AgreementComparison request={request} />
          {request.responseComment ? <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700"><strong>Resposta do cliente:</strong> {request.responseComment}</p> : null}
          {request.cancelReason ? <p className="mt-3 text-sm text-slate-700"><strong>Motivo do cancelamento:</strong> {request.cancelReason}</p> : null}
          {request.supersededBy ? <p className="mt-3 text-xs text-slate-500">Uma nova revisão foi emitida a partir desta proposta. Esta versão permanece no histórico.</p> : null}
          {stale && ['pending', 'approved'].includes(request.status) ? <p className="mt-3 text-sm text-amber-800">O acordo mudou desde esta proposta. O ateliê precisa cancelar esta versão e emitir uma revisão atualizada.</p> : null}
          {clientView && request.status === 'pending' && actionable ? <div className="mt-4 grid gap-3">
            <label className={labelClass}>Comentário sobre a revisão<Textarea maxLength={1000} onChange={(event) => setComments((value) => ({ ...value, [request.id]: event.target.value }))} placeholder="Opcional para aprovação; obrigatório ao recusar ou pedir ajustes." value={comments[request.id] ?? ''} /></label>
            <label className="flex min-h-11 items-start gap-3 rounded-xl border border-violet-200 bg-white p-3 text-sm text-slate-700"><input checked={confirmed[request.id] ?? false} className="mt-1" onChange={(event) => setConfirmed((value) => ({ ...value, [request.id]: event.target.checked }))} type="checkbox" /><span>Li e concordo com o escopo, os materiais, o prazo e o valor apresentados na proposta de alteração v{request.version}.</span></label>
            <div className="flex flex-wrap gap-2"><Button disabled={!!busy || !confirmed[request.id]} onClick={() => void respond(request, 'approved')}>Aprovar revisão v{request.version}</Button><Button disabled={!!busy || (comments[request.id] ?? '').trim().length < 5} onClick={() => void respond(request, 'changes_requested')} variant="secondary">Solicitar ajustes na revisão</Button><Button disabled={!!busy || (comments[request.id] ?? '').trim().length < 5} onClick={() => void respond(request, 'rejected')} variant="secondary">Recusar revisão</Button></div>
          </div> : null}
          {canManage && request.status === 'approved' && actionable ? <div className="mt-4"><Button disabled={!!busy || (financial && !canFinance)} onClick={() => void act(request.id, () => applyOrderChangeRequest({ atelierId: order.atelierId, orderId: order.id, changeRequestId: request.id, requestId: requestId(`apply:${request.id}`), version: request.version, proposalFingerprint: request.proposalFingerprint }), 'Revisão aplicada ao pedido com snapshot e histórico preservados.')}>Aplicar revisão aprovada</Button>{financial && !canFinance ? <p className="mt-2 text-sm text-slate-600">A aplicação desta revisão exige a permissão financeira.</p> : null}</div> : null}
          {canManage && ['pending', 'approved'].includes(request.status) ? <div className="mt-4 grid gap-2"><label className={labelClass}>Motivo para cancelar a proposta<Input maxLength={1000} onChange={(event) => setComments((value) => ({ ...value, [request.id]: event.target.value }))} value={comments[request.id] ?? ''} /></label><Button className="justify-self-start" disabled={!!busy || (comments[request.id] ?? '').trim().length < 5} onClick={() => void act(request.id, () => cancelOrderChangeRequest({ atelierId: order.atelierId, orderId: order.id, changeRequestId: request.id, requestId: requestId(`cancel:${request.id}:${comments[request.id]}`), reason: comments[request.id] ?? '' }), 'Proposta cancelada e preservada no histórico.')} variant="secondary">Cancelar proposta de alteração</Button></div> : null}
          {canManage && !closed && ['rejected', 'changes_requested', 'cancelled'].includes(request.status) && !request.supersededBy ? <Button className="mt-4" disabled={!!busy} onClick={() => openRevision(request)} variant="secondary">Emitir nova revisão</Button> : null}
        </section>;
      })}
      {page?.nextCursor ? <Button disabled={loadingMore || !!busy} onClick={() => void loadMore()} variant="secondary">{loadingMore ? 'Carregando…' : 'Carregar revisões anteriores'}</Button> : null}
    </CardContent>
  </Card>;
}
