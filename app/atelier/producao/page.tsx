'use client';

import Link from 'next/link';
import { ArrowRight, CalendarClock, CircleCheck, Scissors } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAtelierOrders } from '@/features/orders/use-orders';

export default function ProductionPage() {
  const { orders, loading, error } = useAtelierOrders();
  const active = orders.filter((order) => !['completed', 'cancelled', 'refunded'].includes(order.status));
  const inProduction = active.filter((order) => ['confirmed', 'scheduled', 'modeling', 'in_production', 'fitting', 'adjustments', 'finishing', 'paused', 'waiting_final_payment'].includes(order.status));
  const approvals = orders.filter((order) => order.status === 'fitting' || order.status === 'adjustments');
  return <div className="grid gap-5">
    {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</div> : null}
    <Card className="overflow-hidden"><div className="h-1.5 bg-gradient-to-r from-violet-700 to-fuchsia-500" /><CardContent className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7"><div><p className="text-sm font-semibold text-violet-700">Produção do ateliê</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Do planejamento até a entrega</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Acompanhe etapas ponderadas, compartilhe fotos com cada cliente e registre aprovações antes de avançar quando necessário.</p></div><Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-semibold text-white hover:bg-violet-800" href="/atelier/producao/kanban">Abrir Kanban <ArrowRight size={17} /></Link></CardContent></Card>
    {loading ? <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((item) => <Skeleton className="h-28 rounded-2xl" key={item} />)}</div> : <div className="grid gap-4 sm:grid-cols-3">
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Scissors className="text-violet-700" size={18} />Pedidos com produção liberada</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-slate-950">{inProduction.length}</p><p className="mt-1 text-xs text-slate-500">Inclui pedidos confirmados e etapas em andamento.</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CircleCheck className="text-emerald-700" size={18} />Pedidos ativos</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-slate-950">{active.length}</p><p className="mt-1 text-xs text-slate-500">Solicitações aguardando sinal também são exibidas.</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="text-fuchsia-700" size={18} />Confirmações de cliente</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-slate-950">{approvals.length}</p><p className="mt-1 text-xs text-slate-500">Etapas de prova ou ajustes que exigem atenção.</p></CardContent></Card>
    </div>}
    <Card><CardHeader><CardTitle>Pedidos que aguardam uma entrada</CardTitle><p className="text-sm text-slate-600">A equipe financeira confirma o recebimento antes de iniciar as etapas de produção.</p></CardHeader><CardContent>{loading ? <Skeleton className="h-16 rounded-xl" /> : orders.filter((order) => order.status === 'waiting_deposit').length ? <ul className="grid gap-2">{orders.filter((order) => order.status === 'waiting_deposit').map((order) => <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3" key={order.id}><div><p className="font-semibold text-slate-900">{order.character}</p><p className="text-sm text-slate-600">{order.clientName}</p></div><Link className="text-sm font-semibold text-violet-800 underline" href={`/atelier/pedidos/${encodeURIComponent(order.id)}`}>Abrir pedido</Link></li>)}</ul> : <p className="text-sm text-slate-500">Nenhum pedido aguarda confirmação da entrada.</p>}</CardContent></Card>
  </div>;
}
