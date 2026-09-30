import Link from 'next/link';
import { ArrowRight, CalendarDays, Package } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { formatOrderDate, formatOrderMoney, orderStatusLabel } from '@/features/orders/order-format';
import type { Order } from '@/types/order';

export function OrderList({ orders, audience }: { orders: Order[]; audience: 'client' | 'atelier' }) {
  if (!orders.length) return <EmptyState
    description={audience === 'client' ? 'Quando uma proposta aprovada virar pedido, o acompanhamento aparecerá aqui.' : 'Pedidos aprovados pelos clientes aparecerão nesta lista para a equipe acompanhar.'}
    icon={<Package size={21} />}
    title="Nenhum pedido encontrado"
  />;
  return <div className="grid gap-3">{orders.map((order) => {
    const href = audience === 'client'
      ? `/cliente/pedidos/${encodeURIComponent(order.id)}?atelierId=${encodeURIComponent(order.atelierId)}`
      : `/atelier/pedidos/${encodeURIComponent(order.id)}`;
    return <Link className="grid gap-4 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm transition hover:border-violet-200 hover:shadow-md sm:grid-cols-[1fr_auto] sm:items-center sm:p-5" href={href} key={`${order.atelierId}-${order.id}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold text-slate-950">{order.character || 'Projeto de cosplay'}</h2><Badge tone={order.status === 'completed' || order.status === 'delivered' ? 'green' : order.status === 'cancelled' || order.status === 'refunded' ? 'red' : 'violet'}>{orderStatusLabel[order.status] ?? order.status}</Badge></div>
        <p className="mt-1 text-sm text-slate-600">{order.franchise || 'Franquia não informada'}{audience === 'atelier' ? ` · ${order.clientName || order.email}` : ''}</p>
        {audience === 'atelier' && order.clientName && order.email ? <p className="mt-1 text-xs text-slate-500">{order.email}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />Prazo {formatOrderDate(order.expectedDeliveryDate)}</span><span>{formatOrderMoney(order.approvedQuoteSnapshot.total)}</span></div>
      </div>
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700">Abrir pedido<ArrowRight size={16} /></span>
    </Link>;
  })}</div>;
}
