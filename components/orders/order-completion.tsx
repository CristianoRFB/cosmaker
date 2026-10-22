'use client';
import { useId, useRef, useState } from 'react';
import { finalizeOrder } from '@/repositories/orders.repository';
import { useTenant } from '@/providers/tenant-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { Order } from '@/types/order';
import { formatOrderTimestamp } from '@/features/orders/order-format';
export function OrderCompletion({ order, reload, clientView = false }: { order: Order; reload?: () => Promise<void>; clientView?: boolean }) {
  const { hasPermission } = useTenant(); const noteId = useId(); const methodId = useId();
  const [note, setNote] = useState(''); const [method, setMethod] = useState<'pickup' | 'shipping'>('pickup');
  const [confirming, setConfirming] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const retry = useRef({ fingerprint: '', id: '' });
  const canManage = !clientView && hasPermission('orders:manage') && !!reload;
  const action = order.status === 'shipped' ? 'deliver' : 'complete';
  async function confirm() {
    if (busy || !canManage) return; setBusy(true); setError('');
    const input = { orderId: order.id, action: action as 'deliver' | 'complete', note: note.trim(), ...(action === 'deliver' ? { method } : {}), expectedVersion: order.lifecycleVersion ?? 0 };
    const fingerprint = JSON.stringify(input); if (retry.current.fingerprint !== fingerprint) retry.current = { fingerprint, id: crypto.randomUUID() };
    try { await finalizeOrder({ ...input, requestId: retry.current.id }); setConfirming(false); setNote(''); await reload?.(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível registrar a entrega. Atualize o pedido e tente novamente.'); setConfirming(false); }
    finally { setBusy(false); }
  }
  if (!['shipped', 'delivered', 'completed'].includes(order.status)) return null;
  return <Card><CardHeader><CardTitle>Entrega e conclusão</CardTitle></CardHeader><CardContent className="grid gap-4">
    {!!order.deliveredAt && <p className="text-sm text-slate-600">Entrega registrada em {formatOrderTimestamp(order.deliveredAt)} · {order.deliveryMethod === 'shipping' ? 'Envio' : 'Retirada'}</p>}
    {!!order.completedAt && <p role="status" className="text-sm font-semibold text-emerald-800">Pedido concluído em {formatOrderTimestamp(order.completedAt)}. O histórico permanece disponível.</p>}
    {canManage && order.status !== 'completed' && <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); setError(''); setConfirming(true); }}>
      {action === 'deliver' && <div className="grid gap-1.5"><label className="text-sm font-medium text-slate-700" htmlFor={methodId}>Modalidade da entrega</label><Select id={methodId} disabled={busy} value={method} onChange={(event) => setMethod(event.target.value as typeof method)}><option value="pickup">Retirada</option><option value="shipping">Envio</option></Select></div>}
      <div className="grid min-w-0 gap-1.5"><label className="text-sm font-medium text-slate-700" htmlFor={noteId}>Registro visível ao cliente</label><Input id={noteId} required minLength={4} maxLength={600} disabled={busy} value={note} onChange={(event) => setNote(event.target.value)} /></div>
      <p className="text-xs leading-5 text-slate-500 sm:col-span-2">Confira etapas, aprovações, revisões, saldo, materiais e horas futuras. O registro é manual e mantém o histórico; não gera cobrança ou contratação de frete.</p>
      <Button className="justify-self-start" type="submit" disabled={busy || note.trim().length < 4}>{action === 'deliver' ? 'Registrar entrega' : 'Concluir pedido'}</Button>
    </form>}
    {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
    <ConfirmDialog open={confirming} onClose={() => { if (!busy) setConfirming(false); }} onConfirm={() => void confirm()} confirmDisabled={busy}
      title={action === 'deliver' ? 'Confirmar entrega registrada' : 'Confirmar conclusão do pedido'} confirmLabel={action === 'deliver' ? 'Confirmar entrega' : 'Confirmar conclusão'} description="Confirme apenas após conferir o pedido. O registro informado ficará no histórico consultável pelo cliente." />
  </CardContent></Card>;
}
