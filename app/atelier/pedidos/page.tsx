'use client';

import { Package } from 'lucide-react';
import { OrderList } from '@/components/orders/order-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAtelierOrders } from '@/features/orders/use-orders';

export default function AtelierOrdersPage() {
  const { orders, loading, error, reload } = useAtelierOrders();
  const activeOrders = orders.filter((order) => !['completed', 'cancelled', 'refunded'].includes(order.status));
  return <section className="grid gap-5">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Package className="text-violet-700" size={19} />Operação de pedidos</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-600">Pedidos criados a partir de propostas aprovadas. Cada registro preserva os valores aceitos e o histórico da encomenda.</p><p className="mt-3 text-sm font-semibold text-violet-800">{loading ? '—' : `${activeOrders.length} ativos · ${orders.length} no total`}</p></CardContent></Card>
    {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error} <button className="ml-2 font-semibold underline" onClick={() => void reload()} type="button">Tentar novamente</button></div> : null}
    {loading ? <div className="grid gap-3">{[0, 1].map((item) => <Skeleton className="h-32 rounded-2xl" key={item} />)}</div> : <OrderList audience="atelier" orders={orders} />}
  </section>;
}
