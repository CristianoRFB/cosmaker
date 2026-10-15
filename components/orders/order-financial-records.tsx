'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderDepositConfirmation } from '@/components/production/order-deposit-confirmation';
import { useOrderDetail } from '@/features/orders/use-orders';
import { formatOrderMoney, formatOrderTimestamp } from '@/features/orders/order-format';
import { useTenant } from '@/providers/tenant-provider';

const statuses: Record<string, string> = { pending: 'Previsto', paid: 'Confirmado manualmente', cancelled: 'Cancelado internamente', refunded: 'Reversão interna registrada', failed: 'Registro não confirmado' };
const methods: Record<string, string> = { pix: 'Pix registrado', bank_transfer: 'Transferência registrada', cash: 'Dinheiro registrado', other: 'Outro meio registrado' };

export function OrderFinancialRecords({ orderId }: { orderId: string }) {
  const { atelierId, membershipValid, hasPermission } = useTenant();
  const allowed = hasPermission('finance:read');
  const { record, loading, error, reload } = useOrderDetail(allowed ? atelierId ?? '' : '', orderId);
  if (!membershipValid || !allowed) return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Seu perfil não tem permissão para ler os registros financeiros deste pedido.</p>;
  if (loading) return <Skeleton className="h-80 rounded-2xl" />;
  if (error || !record) return <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error || 'Pedido indisponível neste ateliê.'}</p>;
  const { order, payments } = record;
  const total = order.currentAgreement ? order.currentAgreement.totalCents / 100 : order.approvedQuoteSnapshot.total;
  return <section className="grid gap-5"><Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet-700" href={`/atelier/pedidos/${encodeURIComponent(orderId)}`}><ArrowLeft size={16} />Voltar ao pedido</Link><div><h1 className="text-2xl font-bold text-slate-950">Registros financeiros do pedido</h1><p className="mt-1 text-sm text-slate-600">Valores informados pela equipe e confirmações manuais de recebimento.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">{[['Acordo vigente', total], ['Recebimentos confirmados', order.amountPaid], ['Saldo registrado', order.amountRemaining]].map(([label, value]) => <Card key={String(label)}><CardContent className="p-5"><p className="text-sm text-slate-600">{String(label)}</p><p className="mt-2 text-xl font-bold text-slate-950">{formatOrderMoney(Number(value))}</p></CardContent></Card>)}</div>
    <OrderDepositConfirmation record={record} reload={reload} />
    <Card><CardHeader><CardTitle>Histórico de registros ({payments.length})</CardTitle></CardHeader><CardContent>{payments.length ? <ul className="grid gap-3">{payments.map((payment) => <li className="grid gap-2 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1fr_auto]" key={payment.id}><div><p className="font-semibold text-slate-900">{payment.type === 'deposit' ? 'Entrada do pedido' : 'Recebimento do pedido'} · {statuses[payment.status] ?? payment.status}</p><p className="mt-1 text-sm text-slate-600">{payment.method ? methods[payment.method] ?? payment.method : 'Meio ainda não registrado'}</p><p className="mt-1 text-xs text-slate-500">{formatOrderTimestamp(payment.createdAt)}</p></div><p className="font-semibold text-slate-900">{formatOrderMoney(payment.amount)}</p></li>)}</ul> : <p className="text-sm text-slate-500">Nenhum registro financeiro disponível para este pedido.</p>}</CardContent></Card>
  </section>;
}
