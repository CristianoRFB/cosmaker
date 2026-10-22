'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatOrderTimestamp, orderStatusLabel } from '@/features/orders/order-format';
import { useTenant } from '@/providers/tenant-provider';
import { listOrderStatusHistory } from '@/repositories/orders.repository';
import type { OrderHistoryEntry } from '@/types/order';

const sources: Record<string, string> = {
  manual_deliver: 'Entrega registrada manualmente', manual_complete: 'Pedido concluído pela equipe',
  quote_approved: 'Proposta aprovada', manual_deposit_confirmation: 'Entrada confirmada manualmente',
  production_stage_start: 'Etapa iniciada', production_stage_progress: 'Progresso registrado',
  production_stage_complete: 'Etapa concluída', production_stage_block: 'Etapa bloqueada',
  client_production_approval: 'Resposta do cliente à produção',
  client_approved_production_stage: 'Etapa aprovada pelo cliente', client_requested_production_adjustment: 'Ajustes de produção solicitados pelo cliente',
  production_stage_cancel_approval: 'Solicitação de aprovação cancelada pela equipe',
  change_request_proposed: 'Alteração de acordo proposta', change_request_approved: 'Alteração aprovada pelo cliente',
  change_request_rejected: 'Alteração recusada pelo cliente', change_request_changes_requested: 'Ajustes solicitados pelo cliente',
  change_request_applied: 'Acordo aprovado aplicado', change_request_cancelled: 'Alteração cancelada',
  order_change_proposed: 'Alteração de acordo proposta', order_change_approved: 'Alteração aprovada pelo cliente',
  order_change_rejected: 'Alteração recusada pelo cliente', order_change_changes_requested: 'Ajustes solicitados pelo cliente',
  order_change_applied: 'Acordo aprovado aplicado', order_change_cancelled: 'Alteração cancelada',
  production_configuration_updated: 'Planejamento de etapas configurado',
  order_file_uploaded: 'Arquivo anexado', order_file_access_updated: 'Visibilidade de arquivo alterada',
};

export function OrderHistoryWorkspace({ orderId }: { orderId: string }) {
  const { atelierId, membershipValid } = useTenant();
  const [entries, setEntries] = useState<OrderHistoryEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!atelierId || !membershipValid) { setLoading(false); return; }
    try { const page = await listOrderStatusHistory(atelierId, orderId); setEntries(page.entries); setCursor(page.nextCursor); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível ler o histórico.'); }
    finally { setLoading(false); }
  }, [atelierId, orderId, membershipValid]);
  useEffect(() => { setLoading(true); setError(''); void load(); }, [load]);
  async function more() {
    if (!atelierId || !cursor || loading) return;
    setLoading(true); setError('');
    try { const page = await listOrderStatusHistory(atelierId, orderId, cursor); setEntries((current) => [...current, ...page.entries]); setCursor(page.nextCursor); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível carregar a próxima página.'); }
    finally { setLoading(false); }
  }
  return <section className="grid gap-5"><Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet-700" href={`/atelier/pedidos/${encodeURIComponent(orderId)}`}><ArrowLeft size={16} />Voltar ao pedido</Link><h1 className="text-2xl font-bold text-slate-950">Histórico do pedido</h1><p className="text-sm text-slate-600">Eventos preservados do acordo, dos pagamentos registrados e da produção, do mais recente ao mais antigo.</p>{error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p> : null}<Card><CardContent className="p-5">{loading && !entries.length ? <Skeleton className="h-60 rounded-xl" /> : entries.length ? <ol className="grid gap-4 border-l border-violet-200 pl-5">{entries.map((entry) => <li key={entry.id}><p className="font-semibold text-slate-900">{sources[entry.source] ?? 'Atualização registrada no pedido'}</p><p className="mt-1 text-sm text-slate-600">{orderStatusLabel[entry.status] ?? entry.status}</p><p className="mt-1 text-xs text-slate-500">{formatOrderTimestamp(entry.createdAt)}</p>{['manual_deliver', 'manual_complete'].includes(entry.source) && entry.note ? <p className="mt-2 break-words text-sm text-slate-600">{entry.note}</p> : null}</li>)}</ol> : <p className="text-sm text-slate-500">Nenhum evento registrado ou pedido indisponível para esta conta.</p>}</CardContent></Card>{cursor ? <Button disabled={loading} variant="secondary" onClick={() => void more()}>{loading ? 'Carregando…' : 'Carregar eventos anteriores'}</Button> : null}{error ? <Button onClick={() => { setLoading(true); setError(''); void load(); }} variant="secondary">Tentar novamente</Button> : null}</section>;
}
