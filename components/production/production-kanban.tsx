'use client';

import Link from 'next/link';
import { CalendarDays, CircleAlert, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAtelierOrders, useProductionBoard } from '@/features/orders/use-orders';
import { formatOrderDate } from '@/features/orders/order-format';

const laneConfig = [
  { id: 'pending', label: 'A iniciar', tone: 'neutral' as const },
  { id: 'in_progress', label: 'Em andamento', tone: 'violet' as const },
  { id: 'waiting_approval', label: 'Aguardando cliente', tone: 'amber' as const },
  { id: 'blocked', label: 'Bloqueados', tone: 'red' as const },
];

export function ProductionKanban() {
  const { stages, loading, error, reload } = useProductionBoard();
  const { orders, loading: ordersLoading } = useAtelierOrders();
  const currentByOrder = new Map<string, (typeof stages)[number]>();
  [...stages].sort((a, b) => a.order - b.order).forEach((stage) => {
    if (stage.orderStatus === 'waiting_final_payment' && stage.name === 'Envio') return;
    if (!currentByOrder.has(stage.orderId) && !['completed', 'approved'].includes(stage.status)) currentByOrder.set(stage.orderId, stage);
  });
  const current = [...currentByOrder.values()];
  const waitingDeposit = orders.filter((order) => order.status === 'waiting_deposit');
  const waitingFinalPayment = orders.filter((order) => order.status === 'waiting_final_payment');

  return <div className="grid gap-5">
    <Card className="overflow-hidden"><div className="h-1.5 bg-gradient-to-r from-violet-700 to-fuchsia-500" /><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6"><div><p className="text-sm font-medium text-violet-700">Operação do ateliê</p><h2 className="mt-1 text-xl font-bold text-slate-950">Etapas ativas por pedido</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Cada encomenda aparece na etapa atual. Atualize o andamento no detalhe do pedido; aprovações e bloqueios ficam registrados no histórico.</p></div><Button onClick={() => void reload()} variant="secondary"><RefreshCw size={16} />Atualizar quadro</Button></CardContent></Card>
    {waitingDeposit.length || waitingFinalPayment.length ? <section className="grid gap-3 sm:grid-cols-2">
      {waitingDeposit.map((order) => <Card className="border-amber-200 bg-amber-50/50" key={order.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Aguardando entrada</p><p className="mt-1 font-semibold text-slate-950">{order.character}</p><p className="text-sm text-slate-600">{order.clientName}</p></div><Link className="text-sm font-semibold text-violet-800 underline" href={`/atelier/pedidos/${encodeURIComponent(order.id)}`}>Conferir pedido</Link></CardContent></Card>)}
      {waitingFinalPayment.map((order) => <Card className="border-amber-200 bg-amber-50/50" key={order.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Aguardando saldo final</p><p className="mt-1 font-semibold text-slate-950">{order.character}</p><p className="text-sm text-slate-600">{order.clientName}</p></div><Link className="text-sm font-semibold text-violet-800 underline" href={`/atelier/pedidos/${encodeURIComponent(order.id)}`}>Conferir pedido</Link></CardContent></Card>)}
    </section> : null}
    {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</div> : null}
    {loading || ordersLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton className="h-72 rounded-2xl" key={item} />)}</div> : current.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {laneConfig.map((lane) => {
        const laneStages = current.filter((stage) => stage.status === lane.id);
        return <section aria-label={lane.label} className="min-w-0 rounded-2xl bg-slate-100/75 p-3" key={lane.id}>
          <div className="mb-3 flex items-center justify-between gap-2 px-1"><h3 className="text-sm font-bold text-slate-800">{lane.label}</h3><Badge tone={lane.tone}>{laneStages.length}</Badge></div>
          <div className="grid content-start gap-3">
            {laneStages.map((stage) => <Card className="border-white" key={stage.orderId}><CardContent className="p-4">
              <div className="flex items-start justify-between gap-3"><p className="font-semibold leading-5 text-slate-950">{stage.character}</p><Badge tone={stage.priority === 'urgent' ? 'red' : stage.priority === 'high' ? 'amber' : 'neutral'}>{stage.priority === 'urgent' ? 'Urgente' : stage.priority === 'high' ? 'Prioridade alta' : 'Normal'}</Badge></div>
              <p className="mt-1 text-sm text-slate-600">{stage.clientName}</p><p className="mt-3 rounded-lg bg-violet-50 px-2.5 py-2 text-xs font-semibold text-violet-800">{stage.name}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>Progresso do pedido</span><strong className="text-slate-800">{stage.orderProgress}%</strong></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${stage.orderProgress}%` }} /></div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600"><CalendarDays size={14} />Entrega desejada: {formatOrderDate(stage.expectedDeliveryDate)}</p>
              {stage.status === 'waiting_approval' ? <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800"><CircleAlert size={14} />Aguardando retorno do cliente</p> : null}
              <Link className="mt-4 flex min-h-10 items-center justify-center rounded-xl border border-violet-200 px-3 text-sm font-semibold text-violet-800 hover:bg-violet-50" href={`/atelier/pedidos/${encodeURIComponent(stage.orderId)}/producao`}>Abrir etapa e atualizar</Link>
            </CardContent></Card>)}
            {!laneStages.length ? <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500">Sem pedidos nesta coluna.</p> : null}
          </div>
        </section>;
      })}
    </div> : !waitingDeposit.length && !waitingFinalPayment.length ? <EmptyState description="Quando um pedido tiver entrada confirmada, suas etapas aparecerão aqui. Nenhuma ocupação é inventada para preencher o quadro." title="Sem pedidos em produção" /> : <EmptyState description="Os pedidos deste ateliê ainda aguardam confirmação financeira antes de iniciar a produção." title="Produção ainda não iniciada" />}
    <p className="text-xs leading-5 text-slate-500">O cálculo de risco de atraso será exibido junto à agenda de capacidade depois que horas disponíveis, bloqueios e carga de cada pedido estiverem configurados.</p>
  </div>;
}
