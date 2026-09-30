'use client';

import { useState } from 'react';
import { CircleDollarSign } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useTenant } from '@/providers/tenant-provider';
import { confirmOrderDeposit } from '@/repositories/orders.repository';
import { formatOrderMoney } from '@/features/orders/order-format';
import type { OrderRecord } from '@/types/order';

export function OrderDepositConfirmation({ record, reload }: { record: OrderRecord; reload: () => Promise<void> }) {
  const { hasPermission } = useTenant();
  const toast = useToast();
  const [method, setMethod] = useState<'pix' | 'bank_transfer' | 'cash' | 'other'>('pix');
  const [reference, setReference] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const payment = record.payments.find((item) => item.type === 'deposit');
  const canConfirm = hasPermission('payments:write') || hasPermission('finance:write');
  if (record.order.status !== 'waiting_deposit' || !payment) return null;

  async function confirm() {
    setBusy(true);
    try {
      await confirmOrderDeposit(record.order.atelierId, record.order.id, method, reference);
      setConfirming(false);
      toast('Entrada registrada. O pedido está confirmado e as etapas foram inicializadas.', 'success');
      await reload();
    } catch (error) { toast(error instanceof Error ? error.message : 'Não foi possível confirmar a entrada.', 'error'); }
    finally { setBusy(false); }
  }

  return <Card className="border-amber-200 bg-amber-50/40">
    <CardHeader><CardTitle className="flex items-center gap-2"><CircleDollarSign className="text-amber-700" size={19} />Entrada aguardando confirmação</CardTitle><p className="text-sm text-slate-600">O início da produção depende da conferência do sinal pela equipe financeira.</p></CardHeader>
    <CardContent className="grid gap-4 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
      <div><p className="text-xs text-slate-500">Valor previsto</p><p className="mt-1 text-xl font-bold text-slate-950">{formatOrderMoney(payment.amount)}</p></div>
      <div><p className="text-xs text-slate-500">Status do pagamento</p><Badge className="mt-2" tone="amber">Pendente</Badge></div>
      {canConfirm ? <>
        <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs font-semibold text-slate-600">Forma de recebimento<Select onChange={(event) => setMethod(event.target.value as typeof method)} value={method}><option value="pix">Pix</option><option value="bank_transfer">Transferência bancária</option><option value="cash">Dinheiro</option><option value="other">Outro</option></Select></label><label className="grid gap-1 text-xs font-semibold text-slate-600">Referência (opcional)<Input maxLength={120} onChange={(event) => setReference(event.target.value)} placeholder="Identificador ou observação" value={reference} /></label></div>
        <Button onClick={() => setConfirming(true)}>Registrar recebimento</Button>
        <ConfirmDialog confirmDisabled={busy} confirmLabel={busy ? 'Registrando…' : 'Confirmar entrada'} description={`Confirme apenas depois de verificar o recebimento de ${formatOrderMoney(payment.amount)}. O sistema registrará o pagamento como recebido e liberará a produção.`} onClose={() => setConfirming(false)} onConfirm={() => void confirm()} open={confirming} title="Confirmar entrada recebida" />
      </> : <p className="text-sm leading-6 text-slate-600 sm:col-span-2">A sua conta pode acompanhar o pedido, mas não pode confirmar recebimentos financeiros.</p>}
    </CardContent>
  </Card>;
}
