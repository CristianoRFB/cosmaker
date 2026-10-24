'use client';

import Link from 'next/link';
import { Package } from 'lucide-react';
import { OrderList } from '@/components/orders/order-list';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useClientOrders } from '@/features/orders/use-orders';
import { useAuth } from '@/providers/auth-provider';

export default function ClientOrdersPage() {
  const { firebaseUser } = useAuth();
  const { orders, loading, error, hasMore, loadMore, reload } = useClientOrders();
  return <section className="grid gap-5">
    <Card className="flex items-center gap-4 p-5"><span className="grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Package size={21} /></span><div><p className="text-sm text-slate-500">Encomendas vinculadas à sua conta</p><p className="mt-1 text-2xl font-bold text-slate-950">{loading && !orders.length ? '—' : `${orders.length} carregados`}</p></div></Card>
    {firebaseUser?.emailVerified !== true ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Confirme seu e-mail para consultar seus pedidos. <Link className="font-semibold underline" href="/verificar-email">Ir para verificação</Link></div> : null}
    <Button className="justify-self-start" variant="secondary" disabled={loading} onClick={() => void reload()}>Atualizar pedidos</Button>
    {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</div> : null}
    {loading && !orders.length ? <div className="grid gap-3">{[0, 1].map((item) => <Skeleton className="h-32 rounded-2xl" key={item} />)}</div> : firebaseUser?.emailVerified === true ? <OrderList audience="client" orders={orders} /> : null}
    {hasMore ? <Button variant="secondary" disabled={loading} onClick={() => void loadMore()}>{loading ? 'Carregando…' : 'Carregar mais pedidos'}</Button> : null}
  </section>;
}
