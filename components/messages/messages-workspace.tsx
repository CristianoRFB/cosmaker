'use client';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/providers/auth-provider';
import { listMessageInbox, getOrderConversation, markOrderConversationRead, sendOrderMessage } from '@/repositories/conversations.repository';
import { downloadOrderFile } from '@/repositories/order-files.repository';
import type { ConversationSummary, MessageAttachment, OrderConversation } from '@/types/conversation';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível carregar as mensagens. Tente novamente.';
export function MessagesWorkspace({ viewer, selectedOrderId }: { viewer: 'atelier' | 'client'; selectedOrderId?: string }) {
  const { user } = useAuth();
  const [inbox, setInbox] = useState<ConversationSummary[]>([]); const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({ atelierId: '', orderId: '' }); const [thread, setThread] = useState<OrderConversation | null>(null);
  const [threadLoading, setThreadLoading] = useState(false); const [busy, setBusy] = useState(false);
  const [text, setText] = useState(''); const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const inputId = useId();
  const epoch = useRef(0); const invalidate = useCallback(() => { epoch.current++; }, []);
  const inboxEpoch = useRef(0); const invalidateInbox = useCallback(() => { inboxEpoch.current++; }, []);
  const request = useRef({ fingerprint: '', id: '' });
  const loadInbox = useCallback(async () => { const current = ++inboxEpoch.current; setLoading(true); try { const result = await listMessageInbox(); if (current === inboxEpoch.current) setInbox(result.conversations); } catch (err) { if (current === inboxEpoch.current) { setInbox([]); setError(errorMessage(err)); } } finally { if (current === inboxEpoch.current) setLoading(false); } }, []);
  useEffect(() => {
    setInbox([]); setThread(null); setText(''); setAttachmentIds([]); setError(''); setNotice('');
    const query = new URLSearchParams(window.location.search);
    setSelected({ atelierId: viewer === 'atelier' ? user?.atelierId ?? '' : query.get('atelierId') ?? '', orderId: selectedOrderId ?? query.get('pedidoId') ?? '' });
    if (user?.active) void loadInbox();
    return () => { invalidate(); invalidateInbox(); };
  }, [user?.id, user?.active, user?.atelierId, viewer, selectedOrderId, loadInbox, invalidate, invalidateInbox]);
  const loadThread = useCallback(async () => {
    if (!selected.atelierId || !selected.orderId) { setThread(null); return; }
    const current = ++epoch.current; setThreadLoading(true); setError('');
    try {
      const result = await getOrderConversation(selected.atelierId, selected.orderId);
      if (current !== epoch.current) return;
      setThread(result);
      const displayed = result.messages.at(-1)?.sequence ?? 0;
      if (displayed > 0) await markOrderConversationRead(selected.atelierId, selected.orderId, displayed);
      if (current === epoch.current) void loadInbox();
    } catch (err) { if (current === epoch.current) { setThread(null); setError(errorMessage(err)); } }
    finally { if (current === epoch.current) setThreadLoading(false); }
  }, [selected.atelierId, selected.orderId, loadInbox]);
  useEffect(() => { setThread(null); setText(''); setAttachmentIds([]); setNotice(''); void loadThread(); return invalidate; }, [loadThread, invalidate]);
  function select(conversation: ConversationSummary) {
    setSelected({ atelierId: conversation.atelierId, orderId: conversation.id });
    const path = viewer === 'atelier' ? `/atelier/mensagens?pedidoId=${encodeURIComponent(conversation.id)}` : `/cliente/mensagens/${encodeURIComponent(conversation.id)}?atelierId=${encodeURIComponent(conversation.atelierId)}`;
    window.history.replaceState(null, '', path);
  }
  async function send(event: FormEvent) {
    event.preventDefault(); if (!thread || busy) return; const current = epoch.current; setBusy(true); setError(''); setNotice('');
    try {
      const fingerprint = JSON.stringify([selected, text, attachmentIds]);
      if (request.current.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
      await sendOrderMessage(selected.atelierId, selected.orderId, text, attachmentIds, request.current.id);
      if (current !== epoch.current) return;
      setText(''); setAttachmentIds([]); request.current = { fingerprint: '', id: '' }; setNotice('Mensagem registrada na conversa.'); await loadThread();
    } catch (err) { if (current === epoch.current) setError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function older() {
    if (!thread?.nextBeforeSequence || busy) return; setBusy(true); setError('');
    const current = epoch.current;
    try { const page = await getOrderConversation(selected.atelierId, selected.orderId, thread.nextBeforeSequence); if (current === epoch.current) setThread((old) => old ? { ...old, messages: [...page.messages, ...old.messages], nextBeforeSequence: page.nextBeforeSequence } : page); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function download(attachment: MessageAttachment) {
    try { await downloadOrderFile(selected.atelierId, selected.orderId, { id: attachment.id, storagePath: '', originalName: attachment.originalName!, contentType: attachment.contentType!, size: attachment.size!, source: 'order_upload', createdAt: null }); }
    catch (err) { setError(errorMessage(err)); }
  }
  return <section className="grid min-w-0 gap-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-950">Mensagens de pedidos</h1><p className="mt-1 text-sm text-slate-600">Converse com o cliente e a equipe no histórico do próprio pedido.</p></div><Button variant="secondary" disabled={busy || threadLoading} onClick={() => { void loadInbox(); if (selected.orderId) void loadThread(); }}>Atualizar conversas</Button></div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"><Card><CardHeader><CardTitle>Conversas</CardTitle></CardHeader><CardContent>{loading ? <Skeleton className="h-32" /> : inbox.length ? <ul className="grid gap-2">{inbox.map((conversation) => <li key={`${conversation.atelierId}/${conversation.id}`}><button className={`w-full rounded-xl border p-3 text-left ${selected.orderId === conversation.id && selected.atelierId === conversation.atelierId ? 'border-violet-300 bg-violet-50' : 'border-slate-200'}`} onClick={() => select(conversation)}><span className="block break-words text-sm font-semibold text-slate-900">{conversation.character}</span><span className="mt-1 block break-words text-xs text-slate-500">{conversation.preview}</span>{conversation.unread > 0 && <span className="mt-2 block text-xs font-semibold text-violet-700">{conversation.unread} não lida(s)</span>}</button></li>)}</ul> : <p className="text-sm leading-6 text-slate-500">Nenhuma conversa iniciada. Abra um pedido para conversar.</p>}<Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-violet-700" href={viewer === 'atelier' ? '/atelier/pedidos' : '/cliente/pedidos'}>Abrir meus pedidos →</Link></CardContent></Card>
      {threadLoading ? <Skeleton className="h-96 rounded-2xl" /> : thread ? <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{thread.character}</CardTitle><Link className="text-sm font-semibold text-violet-700" href={`${viewer === 'atelier' ? '/atelier' : '/cliente'}/pedidos/${encodeURIComponent(selected.orderId)}${viewer === 'client' ? `?atelierId=${encodeURIComponent(selected.atelierId)}` : ''}`}>Abrir pedido</Link></div></CardHeader><CardContent>{thread.nextBeforeSequence && <Button className="mb-4" variant="secondary" disabled={busy} onClick={() => void older()}>Carregar mensagens anteriores</Button>}
      <ol aria-label="Histórico da conversa" className="grid max-h-[60vh] gap-3 overflow-y-auto pb-3">{thread.messages.length ? thread.messages.map((message) => <li className={`max-w-full rounded-xl border p-4 ${message.mine ? 'border-violet-100 bg-violet-50' : 'border-slate-200 bg-white'}`} key={message.id}><p className="text-xs font-semibold text-slate-600">{message.mine ? 'Você' : message.sender} · {new Date(message.createdAt).toLocaleString('pt-BR')}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-900">{message.text}</p>{message.attachments.map((attachment) => <div className="mt-2" key={attachment.id}>{attachment.available ? <Button variant="secondary" onClick={() => void download(attachment)}>Baixar {attachment.originalName}</Button> : <span className="text-xs text-slate-500">Anexo indisponível ou compartilhamento revogado</span>}</div>)}{message.mine && <p className="mt-2 text-xs text-slate-500">{message.sequence <= thread.peerReadSequence ? 'Lida' : 'Enviada'}</p>}</li>) : <li className="text-sm text-slate-500">Inicie a conversa sobre este pedido.</li>}</ol>
      {thread.canSend ? <form className="mt-5 grid gap-3 border-t border-slate-100 pt-4" onSubmit={send}><label className="text-sm font-semibold text-slate-700" htmlFor={inputId}>Mensagem</label><textarea className="min-h-24 rounded-xl border border-slate-300 p-3 text-sm" disabled={busy} id={inputId} maxLength={4000} value={text} onChange={(event) => setText(event.target.value)} />{thread.attachments.length > 0 && <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-semibold text-slate-700">Anexos já compartilhados no pedido</legend>{thread.attachments.map((attachment) => <label className="flex min-h-10 items-center gap-2 text-sm text-slate-600" key={attachment.id}><input type="checkbox" disabled={busy} checked={attachmentIds.includes(attachment.id)} onChange={(event) => setAttachmentIds((current) => event.target.checked ? [...current, attachment.id] : current.filter((id) => id !== attachment.id))} />{attachment.originalName}</label>)}</fieldset>}<Button className="justify-self-start" disabled={busy || (!text.trim() && attachmentIds.length === 0)} type="submit">{busy ? 'Enviando…' : 'Enviar mensagem'}</Button></form> : <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Seu acesso permite acompanhar o histórico. O envio exige permissão de gestão e vínculo do cliente confirmado.</p>}
      </CardContent></Card> : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">Selecione uma conversa ou abra um pedido para iniciar.</p>}
    </div>
  </section>;
}
