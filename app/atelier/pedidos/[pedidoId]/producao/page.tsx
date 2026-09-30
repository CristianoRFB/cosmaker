'use client';

import Link from 'next/link';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { useParams } from 'next/navigation';
import { ProductionStageControls } from '@/components/production/production-stage-controls';
import { ProductionTimeline } from '@/components/production/production-timeline';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatOrderDate, orderStatusLabel } from '@/features/orders/order-format';
import { useOrderDetail } from '@/features/orders/use-orders';
import { useTenant } from '@/providers/tenant-provider';

export default function AtelierOrderProductionPage() {
  const params = useParams<{ pedidoId: string }>();
  const { atelierId, membershipValid } = useTenant();
  const { record, loading, error, reload } = useOrderDetail(atelierId ?? '', params.pedidoId, 'atelier');
  if (loading) return <div className="grid gap-4"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div>;
  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</div>;
  if (!membershipValid || !record) return <div className="text-sm text-slate-600">O pedido não existe neste ateliê ou sua conta não pode acessá-lo.</div>;
  return <div className="grid gap-5">
    <Link className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700" href={`/atelier/pedidos/${encodeURIComponent(record.order.id)}`}><ArrowLeft size={16} />Voltar aos dados do pedido</Link>
    <header className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-violet-100 sm:p-6"><div className="flex flex-wrap items-center gap-2"><Badge tone="violet">{orderStatusLabel[record.order.status]}</Badge><span className="text-sm text-slate-500">Pedido #{record.order.id.slice(0, 8).toUpperCase()}</span></div><h2 className="mt-2 text-2xl font-bold text-slate-950">{record.order.character}</h2><p className="mt-1 text-sm text-slate-600">{record.order.clientName} · {record.order.franchise}</p><p className="mt-3 flex items-center gap-2 text-sm text-slate-600"><CalendarDays size={16} />Entrega desejada: {formatOrderDate(record.order.expectedDeliveryDate)}</p></header>
    <section><h2 className="mb-3 text-lg font-semibold text-slate-950">Atualizar etapa</h2><ProductionStageControls record={record} reload={reload} /></section>
    <ProductionTimeline record={record} />
  </div>;
}
