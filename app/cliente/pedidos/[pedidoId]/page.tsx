'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { OrderDetail } from '@/components/orders/order-detail';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrderDetail } from '@/features/orders/use-orders';

export default function ClientOrderDetailPage() {
  const params = useParams<{ pedidoId: string }>();
  const [atelierId, setAtelierId] = useState('');
  useEffect(() => { setAtelierId(new URLSearchParams(window.location.search).get('atelierId') ?? ''); }, []);
  const { record, loading, error, reload } = useOrderDetail(atelierId, params.pedidoId, 'client');
  if (loading) return <div className="grid gap-4"><Skeleton className="h-14 rounded-2xl" /><Skeleton className="h-56 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;
  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</div>;
  if (!record) return <div className="grid gap-4"><p className="text-sm text-slate-600">O pedido não existe ou não está vinculado à sua conta.</p><Link className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700" href="/cliente/pedidos"><ArrowLeft size={16} />Voltar para pedidos</Link></div>;
  return <OrderDetail backHref="/cliente/pedidos" clientView onRefresh={reload} record={record} />;
}
