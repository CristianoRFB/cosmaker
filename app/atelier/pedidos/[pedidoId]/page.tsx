'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { OrderDetail } from '@/components/orders/order-detail';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrderDetail } from '@/features/orders/use-orders';
import { useTenant } from '@/providers/tenant-provider';

export default function AtelierOrderDetailPage() {
  const params = useParams<{ pedidoId: string }>();
  const { atelierId, membershipValid } = useTenant();
  const { record, loading, error, reload } = useOrderDetail(atelierId ?? '', params.pedidoId, 'atelier');
  if (loading) return <div className="grid gap-4"><Skeleton className="h-14 rounded-2xl" /><Skeleton className="h-56 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;
  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</div>;
  if (!membershipValid || !record) return <div className="grid gap-4"><p className="text-sm text-slate-600">O pedido não existe neste ateliê ou sua conta não pode acessá-lo.</p><Link className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700" href="/atelier/pedidos"><ArrowLeft size={16} />Voltar para pedidos</Link></div>;
  return <OrderDetail backHref="/atelier/pedidos" onRefresh={reload} record={record} />;
}
