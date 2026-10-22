'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { listInternalNotifications, markInternalNotificationRead } from '@/repositories/notifications.repository';
import { useAuth } from '@/providers/auth-provider';
import type { Notification } from '@/types/notification';
export function InternalNotifications({ viewer }: { viewer: 'atelier' | 'client' }) {
  const { user } = useAuth(); const [rows, setRows] = useState<Notification[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const epoch = useRef(0); const invalidate = useCallback(() => { epoch.current++; }, []);
  const load = useCallback(async () => { const current = ++epoch.current; setLoading(true); setError(''); try { const result = await listInternalNotifications(); if (current === epoch.current) { setRows(result.notifications); setCursor(result.nextCursor); } } catch (err) { if (current === epoch.current) { setRows([]); setError(err instanceof Error ? err.message : 'Não foi possível carregar as notificações.'); } } finally { if (current === epoch.current) setLoading(false); } }, []);
  useEffect(() => { setRows([]); setCursor(null); setError(''); if (user?.active) void load(); return invalidate; }, [user?.id, user?.active, load, invalidate]);
  async function read(row: Notification) { setBusy(true); setError(''); try { await markInternalNotificationRead(row.atelierId, row.id); setRows((current) => current.map((item) => item.id === row.id ? { ...item, read: true } : item)); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível atualizar a leitura.'); } finally { setBusy(false); } }
  async function more() { if (!cursor) return; const generation = epoch.current; setBusy(true); try { const result = await listInternalNotifications(cursor); if (generation === epoch.current) { setRows((current) => [...current, ...result.notifications]); setCursor(result.nextCursor); } } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível carregar a página.'); } finally { setBusy(false); } }
  function href(row: Notification) {
    return row.type === 'order_message' ? viewer === 'atelier' ? `/atelier/mensagens?pedidoId=${encodeURIComponent(row.orderId)}` : `/cliente/mensagens/${encodeURIComponent(row.orderId)}?atelierId=${encodeURIComponent(row.atelierId)}`
      : `${viewer === 'atelier' ? '/atelier' : '/cliente'}/pedidos/${encodeURIComponent(row.orderId)}${viewer === 'client' ? `?atelierId=${encodeURIComponent(row.atelierId)}` : ''}`;
  }
  return <section className="grid gap-5"><div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-950">Notificações internas</h1><p className="mt-1 text-sm text-slate-600">Mensagens e solicitações de aprovação dos seus pedidos.</p></div><Button variant="secondary" disabled={loading || busy} onClick={() => void load()}>Atualizar notificações</Button></div>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{loading ? <Skeleton className="h-64 rounded-2xl" /> : rows.length ? rows.map((row) => <Card key={`${row.atelierId}/${row.id}`}><CardContent className="p-5"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold text-slate-950">{row.title}</h2><span className="text-xs text-slate-500">{row.read ? 'Lida' : 'Não lida'}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{row.message}</p><p className="mt-2 text-xs text-slate-500">{new Date(row.createdAt).toLocaleString('pt-BR')}</p><div className="mt-3 flex flex-wrap items-center gap-3"><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-violet-700" href={href(row)}>Abrir {row.type === 'order_message' ? 'conversa' : 'pedido'} →</Link>{!row.read && <Button variant="secondary" disabled={busy} onClick={() => void read(row)}>Marcar como lida</Button>}</div></CardContent></Card>) : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">Nenhuma notificação disponível para sua conta.</p>}{cursor && <Button variant="secondary" disabled={busy} onClick={() => void more()}>Carregar mais notificações</Button>}</section>;
}
