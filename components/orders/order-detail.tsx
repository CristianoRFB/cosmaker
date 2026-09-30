'use client';

import Link from 'next/link';
import { ArrowLeft, CalendarDays, ClipboardList, Ruler } from 'lucide-react';
import { ClientProductionApprovals } from '@/components/production/client-production-approvals';
import { OrderDepositConfirmation } from '@/components/production/order-deposit-confirmation';
import { ProductionTimeline } from '@/components/production/production-timeline';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatOrderDate, formatOrderMoney, formatOrderTimestamp, orderStatusLabel } from '@/features/orders/order-format';
import type { OrderRecord } from '@/types/order';

export function OrderDetail({ record, backHref, clientView = false, onRefresh }: {
  record: OrderRecord; backHref: string; clientView?: boolean; onRefresh?: () => Promise<void>;
}) {
  const { order, items, files, history, measurements } = record;
  return <div className="grid gap-5">
    <Link className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700" href={backHref}><ArrowLeft size={16} />Voltar para pedidos</Link>
    <Card className="overflow-hidden"><div className="h-1.5 bg-gradient-to-r from-violet-700 to-fuchsia-500" /><CardContent className="grid gap-6 p-5 sm:grid-cols-[1fr_auto] sm:p-7"><div>
      <div className="flex flex-wrap items-center gap-2"><Badge tone="violet">{orderStatusLabel[order.status] ?? order.status}</Badge><span className="text-sm text-slate-500">Pedido #{order.id.slice(0, 8).toUpperCase()}</span></div>
      <h2 className="mt-3 text-2xl font-bold text-slate-950 sm:text-3xl">{order.character}</h2><p className="mt-1 text-slate-600">{order.franchise} · {order.category}</p>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">{order.description}</p>
      {!clientView && record.productionStages.length ? <Link className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50" href={`/atelier/pedidos/${encodeURIComponent(order.id)}/producao`}>Gerenciar produção</Link> : null}
    </div><div className="grid content-start gap-3 rounded-2xl bg-violet-50 p-4 sm:min-w-56">
      <div><p className="text-xs text-violet-700">Total aprovado</p><p className="mt-1 text-xl font-bold text-slate-950">{formatOrderMoney(order.approvedQuoteSnapshot.total)}</p></div>
      <div className="border-t border-violet-100 pt-3"><p className="text-xs text-violet-700">Entrada prevista</p><p className="mt-1 font-semibold text-slate-800">{formatOrderMoney(order.approvedQuoteSnapshot.depositAmount)}</p></div>
      <div className="border-t border-violet-100 pt-3"><p className="text-xs text-violet-700">Saldo registrado</p><p className="mt-1 font-semibold text-slate-800">{formatOrderMoney(order.amountRemaining ?? order.approvedQuoteSnapshot.total)}</p></div>
    </div></CardContent></Card>

    {!clientView && onRefresh ? <OrderDepositConfirmation record={record} reload={onRefresh} /> : null}

    <div className="grid gap-4 sm:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="text-violet-700" size={18} />Prazo do projeto</CardTitle></CardHeader><CardContent>
      <p className="text-sm text-slate-600">Entrega desejada</p><p className="mt-1 font-semibold text-slate-900">{formatOrderDate(order.expectedDeliveryDate)}</p>
      <p className="mt-3 text-sm text-slate-600">Início previsto: {formatOrderDate(order.approvedQuoteSnapshot.expectedStartDate ?? undefined)}</p>
      <p className="mt-1 text-sm text-slate-600">Conclusão prevista: {formatOrderDate(order.approvedQuoteSnapshot.expectedCompletionDate ?? undefined)}</p>
    </CardContent></Card><Card><CardHeader><CardTitle>Andamento</CardTitle></CardHeader><CardContent>
      <div className="flex items-center justify-between text-sm"><span className="text-slate-600">Progresso registrado</span><strong className="text-slate-950">{order.progress}%</strong></div>
      <div aria-label={`Progresso ${order.progress}%`} className="mt-3 h-2.5 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${Math.min(100, Math.max(0, order.progress))}%` }} /></div>
      <p className="mt-3 text-xs leading-5 text-slate-500">O progresso é calculado pelas etapas ponderadas do projeto.</p>
    </CardContent></Card></div>

    {clientView && onRefresh ? <ClientProductionApprovals record={record} reload={onRefresh} /> : null}
    <ProductionTimeline clientView={clientView} record={record} />

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="text-violet-700" size={18} />Itens aprovados</CardTitle></CardHeader><CardContent>{items.length ? <div className="divide-y divide-slate-100">{items.map((item) => <div className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:items-center" key={item.id}><div><p className="font-medium text-slate-900">{item.description}</p><p className="text-xs capitalize text-slate-500">{item.category} · {item.quantity} un. × {formatOrderMoney(item.unitPrice)}</p></div><p className="font-semibold text-slate-900">{formatOrderMoney(item.total)}</p></div>)}</div> : <p className="text-sm text-slate-600">Os itens detalhados não foram registrados neste pedido.</p>}</CardContent></Card>

    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Ruler className="text-violet-700" size={18} />Medidas congeladas neste pedido</CardTitle></CardHeader><CardContent>{measurements.length ? <div className="grid gap-2">{measurements.map((measurement) => <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2" key={measurement.id}><span className="text-sm text-slate-700">{measurement.label}</span><span className="font-semibold text-slate-950">{measurement.value} {measurement.unit}</span></div>)}<p className="mt-2 text-xs leading-5 text-slate-500">Esta cópia pertence ao pedido e não muda quando a ficha atual é editada.</p></div> : <EmptyState description="Nenhuma ficha estava vinculada quando este pedido foi confirmado. Uma ficha criada agora vale para pedidos futuros." title="Sem medidas registradas no snapshot" action={clientView ? <Link className="font-semibold text-violet-700" href={`/cliente/medidas/nova?atelierId=${encodeURIComponent(order.atelierId)}`}>Criar ficha de medidas</Link> : null} />}</CardContent></Card>
      <Card><CardHeader><CardTitle>Referências e histórico</CardTitle></CardHeader><CardContent>
        <h3 className="text-sm font-semibold text-slate-900">Arquivos do projeto</h3>{files.length ? <ul className="mt-2 grid gap-2">{files.map((file) => <li className="rounded-xl border border-slate-100 px-3 py-2 text-sm" key={file.id}><span className="block font-medium text-slate-800">{file.originalName}</span><span className="text-xs text-slate-500">{file.contentType} · {(file.size / 1024).toFixed(0)} KB</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">Nenhum arquivo de referência anexado.</p>}
        <h3 className="mt-5 text-sm font-semibold text-slate-900">Histórico do pedido</h3>{history.length ? <ol className="mt-3 grid gap-3 border-l border-violet-200 pl-4">{history.map((entry) => <li className="relative" key={entry.id}><span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-violet-600" /><p className="text-sm font-semibold text-slate-800">{orderStatusLabel[entry.status] ?? entry.status}</p><p className="mt-1 text-xs text-slate-500">{formatOrderTimestamp(entry.createdAt)}</p></li>)}</ol> : <p className="mt-2 text-sm text-slate-500">O histórico ainda não tem outros eventos.</p>}
      </CardContent></Card>
    </div>
  </div>;
}
