'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useClientOrders } from '@/features/orders/use-orders';
import { formatOrderMoney, formatOrderDate } from '@/features/orders/order-format';
import { getClientPayment, listClientOrderPayments, type ClientPaymentsPage } from '@/repositories/payments.repository';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const statusLabels: Record<string, string> = { pending: 'Pendente', generated: 'Registrado', paid: 'Recebimento confirmado', overdue: 'Em atraso', cancelled: 'Cancelado', refunded: 'Recebimento compensado' };
const typeLabels: Record<string, string> = { deposit: 'Entrada', installment: 'Parcela', final: 'Pagamento final', refund: 'Reembolso' };
const methodLabels: Record<string, string> = { pix: 'Pix', bank_transfer: 'Transferência', cash: 'Dinheiro', card: 'Cartão', other: 'Outro' };
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Data não registrada';

function PaymentRecords({ atelierId, orderId, paymentId }: { atelierId: string; orderId: string; paymentId?: string }) {
  const [page, setPage] = useState<ClientPaymentsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  async function load(cursor?: string) {
    setLoading(true); setError('');
    try {
      const result = paymentId ? await getClientPayment(atelierId, orderId, paymentId) : await listClientOrderPayments(atelierId, orderId, cursor);
      if (mounted.current) setPage(current => cursor && current ? { ...result, payments: [...current.payments, ...result.payments] } : result);
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Não foi possível consultar os registros.'); }
    finally { if (mounted.current) setLoading(false); }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
    // Parent keys this component by session, tenant, order and payment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div className="grid gap-5">
    {error ? <Card role="alert" className="border-rose-200 p-5"><p className="break-words text-sm text-rose-800">{error}</p><Button variant="secondary" className="mt-3" disabled={loading} onClick={() => void load(page?.nextCursor || undefined)}>Tentar novamente</Button></Card> : null}
    {loading ? <p role="status">Carregando registros de pagamento…</p> : null}
    {page ? <>
      <Card className="grid gap-4 p-5"><h2 className="break-words text-lg font-semibold">{page.order.character}</h2>
        <dl className="grid gap-4 sm:grid-cols-3">{[['Total do acordo', page.order.revenueCents], ['Recebido pelo ateliê', page.order.receivedCents], ['Saldo restante', page.order.remainingCents]].map(([label, value]) => <div key={String(label)}><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-1 text-lg font-semibold">{formatOrderMoney(Number(value) / 100)}</dd></div>)}</dl>
        <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-violet-700 underline" href={`/cliente/pedidos/${encodeURIComponent(orderId)}?atelierId=${encodeURIComponent(atelierId)}`}>Abrir pedido</Link>
      </Card>
      {!page.payments.length ? <Card className="p-5"><h2 className="font-semibold">Nenhum registro de pagamento</h2><p className="mt-2 text-sm text-slate-600">O ateliê ainda não registrou pagamentos neste pedido.</p></Card> : <ul className="grid gap-3">{page.payments.map(payment => <li key={payment.id}><Card className="grid gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{typeLabels[payment.type] || payment.type}</h2><p className="text-lg font-semibold">{formatOrderMoney(payment.amountCents / 100)}</p></div>
        <p className="text-sm font-medium">{statusLabels[payment.status] || payment.status}</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Forma declarada</dt><dd>{payment.method ? methodLabels[payment.method] || payment.method : 'Não informada'}</dd></div><div><dt className="text-slate-500">Registro</dt><dd>{dateTime(payment.createdAt)}</dd></div>
          {payment.paidAt ? <div><dt className="text-slate-500">Recebimento declarado</dt><dd>{dateTime(payment.paidAt)}</dd></div> : null}
          {payment.reversedAt ? <div><dt className="text-slate-500">Compensação registrada</dt><dd>{dateTime(payment.reversedAt)}</dd></div> : null}
          {payment.dueDate ? <div><dt className="text-slate-500">Vencimento</dt><dd>{formatOrderDate(payment.dueDate)}</dd></div> : null}
        </dl>
        {!paymentId ? <Link className="inline-flex min-h-11 items-center break-all text-sm font-semibold text-violet-700 underline" href={`/cliente/pagamentos/${encodeURIComponent(payment.id)}?atelierId=${encodeURIComponent(atelierId)}&orderId=${encodeURIComponent(orderId)}`}>Detalhes do registro</Link> : null}
      </Card></li>)}</ul>}
      {page.nextCursor ? <Button variant="secondary" disabled={loading} onClick={() => void load(page.nextCursor!)}>Carregar mais registros</Button> : null}
    </> : null}
  </div>;
}

export function ClientPayments({ paymentId }: { paymentId?: string }) {
  const { firebaseUser, user } = useAuth();
  const { orders, loading, error } = useClientOrders();
  const [selection, setSelection] = useState<{ uid: string; value: string } | null>(null);
  const uid = firebaseUser?.uid || '';
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const atelierId = query.get('atelierId'); const orderId = query.get('orderId');
    setSelection({ uid, value: atelierId && orderId ? `${atelierId}/${orderId}` : '' });
  }, [uid]);
  if (!user?.active || user.accountType !== 'client') return <p role="alert">Sua conta não tem acesso aos registros do cliente.</p>;
  if (firebaseUser?.emailVerified !== true) return <p>Confirme seu e-mail para consultar seus registros. <Link href="/verificar-email" className="underline">Verificar e-mail</Link></p>;
  const selected = selection?.uid === uid ? selection.value || (!paymentId && orders[0] ? `${orders[0].atelierId}/${orders[0].id}` : '') : '';
  const [atelierId, orderId, extra] = selected.split('/');
  return <section className="grid gap-5"><h1 className="text-2xl font-semibold">{paymentId ? 'Detalhe do pagamento' : 'Meus pagamentos'}</h1>
    <p className="text-sm leading-6 text-slate-600">Registros declarados manualmente pelo ateliê. Combine diretamente com ele os próximos recebimentos.</p>
    {paymentId ? <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-violet-700 underline" href={`/cliente/pagamentos?atelierId=${encodeURIComponent(atelierId || '')}&orderId=${encodeURIComponent(orderId || '')}`}>Voltar para pagamentos</Link> : null}
    {!paymentId && orders.length ? <label htmlFor="payment-order" className="grid min-w-0 gap-2 text-sm font-medium">Pedido<select id="payment-order" className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3" value={selected} onChange={event => setSelection({ uid, value: event.target.value })}><option value="" disabled>Selecione um pedido</option>{orders.map(order => <option key={`${order.atelierId}/${order.id}`} value={`${order.atelierId}/${order.id}`}>{order.character || 'Projeto'} · {order.id.slice(0, 8)}</option>)}</select></label> : null}
    {loading ? <p role="status">Carregando pedidos…</p> : null}
    {error ? <p role="alert" className="text-sm text-rose-800">{error}</p> : null}
    {atelierId && orderId && !extra ? <PaymentRecords key={`${uid}/${selected}/${paymentId || ''}`} atelierId={atelierId} orderId={orderId} paymentId={paymentId} /> : !loading && !error ? <Card className="p-5"><h2 className="font-semibold">{paymentId ? 'Selecione o pedido do registro' : 'Nenhum pedido encontrado'}</h2><p className="mt-2 text-sm text-slate-600">Os registros ficam disponíveis nos pedidos vinculados à sua conta.</p><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-violet-700 underline" href="/cliente/pedidos">Ver meus pedidos</Link></Card> : null}
  </section>;
}
