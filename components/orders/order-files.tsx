'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Download, RefreshCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/providers/tenant-provider';
import { downloadOrderFile, listOrderFiles, updateOrderFileAccess, uploadOrderFile } from '@/repositories/order-files.repository';
import type { OrderFile } from '@/types/order';

function message(error: unknown) {
  return error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Não foi possível concluir a ação. Tente novamente.';
}
const categories: Record<NonNullable<OrderFile['category']>, string> = { reference: 'Referência', document: 'Documento', approval: 'Aprovação', shipping: 'Entrega' };

export function OrderFileDownload({ file, atelierId, orderId }: { file: OrderFile; atelierId: string; orderId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div className="grid gap-1"><Button disabled={busy || (file.uploadStatus !== undefined && file.uploadStatus !== 'ready')} variant="secondary" onClick={() => {
    setBusy(true); setError('');
    void downloadOrderFile(atelierId, orderId, file).catch((failure) => setError(message(failure))).finally(() => setBusy(false));
  }}><Download size={16} />{busy ? 'Baixando…' : 'Baixar arquivo'}</Button>{error ? <p className="text-xs text-rose-700" role="alert">{error}</p> : null}</div>;
}

export function OrderFilesWorkspace({ orderId }: { orderId: string }) {
  const { atelierId, membershipValid, loading: tenantLoading, hasPermission } = useTenant();
  const canRead = hasPermission('orders:read') || hasPermission('orders:manage');
  const canManage = hasPermission('orders:manage');
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<File | null>(null);
  const [category, setCategory] = useState<NonNullable<OrderFile['category']>>('reference');
  const [visibleToClient, setVisibleToClient] = useState(false);
  const uploadKey = useRef({ fingerprint: '', requestId: '' });
  const actionKeys = useRef(new Map<string, string>());
  const fileInput = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    if (!atelierId || !membershipValid || !canRead) { setLoading(false); return; }
    try { setFiles(await listOrderFiles(atelierId, orderId)); }
    catch (failure) { setError(message(failure)); }
    finally { setLoading(false); }
  }, [atelierId, orderId, membershipValid, canRead]);
  useEffect(() => { setLoading(true); setError(''); void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!atelierId || !selected) { setError('Escolha o arquivo que deseja enviar.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(selected.type) || selected.size < 1 || selected.size > 20 * 1024 * 1024) {
      setError('Use imagem JPEG, PNG, WebP ou PDF de até 20 MB.'); return;
    }
    const fingerprint = JSON.stringify([selected.name, selected.size, selected.lastModified, category, visibleToClient]);
    if (uploadKey.current.fingerprint !== fingerprint) uploadKey.current = { fingerprint, requestId: crypto.randomUUID() };
    setBusy(true); setError(''); setNotice('');
    try {
      await uploadOrderFile({ atelierId, orderId, file: selected, category, visibleToClient, requestId: uploadKey.current.requestId });
      setSelected(null); uploadKey.current = { fingerprint: '', requestId: '' };
      if (fileInput.current) fileInput.current.value = '';
      setNotice('Arquivo validado e anexado ao pedido.'); await load();
    } catch (failure) {
      const details = failure && typeof failure === 'object' && 'details' in failure ? failure.details : null;
      if (details && typeof details === 'object' && 'reason' in details && details.reason === 'upload_rejected') uploadKey.current = { fingerprint: '', requestId: '' };
      setError(message(failure));
    }
    finally { setBusy(false); }
  }
  async function access(file: OrderFile, visible: boolean, archived: boolean) {
    if (!atelierId) return;
    const fingerprint = JSON.stringify([file.id, file.revision ?? 0, visible, archived]);
    if (!actionKeys.current.has(fingerprint)) actionKeys.current.set(fingerprint, crypto.randomUUID());
    setBusy(true); setError(''); setNotice('');
    try {
      await updateOrderFileAccess({ atelierId, orderId, fileId: file.id, expectedRevision: file.revision ?? 0, visibleToClient: visible, archived, requestId: actionKeys.current.get(fingerprint)! });
      actionKeys.current.delete(fingerprint); setNotice('Acesso ao arquivo atualizado.'); await load();
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  if (tenantLoading || loading) return <Skeleton className="h-80 rounded-2xl" />;
  if (!membershipValid || !canRead) return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Sua conta não tem acesso aos arquivos deste pedido.</p>;
  return <section className="grid gap-5">
    <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet-700" href={`/atelier/pedidos/${encodeURIComponent(orderId)}`}><ArrowLeft size={16} />Voltar ao pedido</Link>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-950">Arquivos do pedido</h1><p className="mt-1 text-sm text-slate-600">Referências e documentos com visibilidade definida pela equipe.</p></div><Button disabled={busy} variant="secondary" onClick={() => { setLoading(true); setError(''); void load(); }}><RefreshCw size={16} />Atualizar</Button></div>
    {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p> : null}
    {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{notice}</p> : null}
    {canManage ? <Card><CardHeader><CardTitle>Anexar arquivo</CardTitle></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
      <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2">Arquivo<input ref={fileInput} accept="image/jpeg,image/png,image/webp,application/pdf" className="min-h-11 rounded-xl border border-slate-300 p-2" disabled={busy} onChange={(event) => { setSelected(event.target.files?.[0] ?? null); uploadKey.current = { fingerprint: '', requestId: '' }; }} required type="file" /><span className="text-xs font-normal text-slate-500">JPEG, PNG, WebP ou PDF; até 20 MB.</span></label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">Categoria<select className="min-h-11 rounded-xl border border-slate-300 px-3" disabled={busy} onChange={(event) => setCategory(event.target.value as typeof category)} value={category}>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="flex items-center gap-2 text-sm text-slate-700"><input checked={visibleToClient} disabled={busy} onChange={(event) => setVisibleToClient(event.target.checked)} type="checkbox" />Compartilhar com o cliente</label>
      <div className="sm:col-span-2"><Button disabled={busy || !selected} type="submit"><Upload size={16} />{busy ? 'Enviando…' : 'Enviar e validar'}</Button></div>
    </form></CardContent></Card> : null}
    <Card><CardHeader><CardTitle>Arquivos registrados ({files.length})</CardTitle></CardHeader><CardContent>{files.length ? <ul className="grid gap-3">{files.map((file) => <li className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1fr_auto]" key={file.id}>
      <div><p className="break-all font-semibold text-slate-900">{file.originalName}</p><p className="mt-1 text-xs text-slate-500">{categories[file.category ?? 'reference']} · {(file.size / 1024).toFixed(0)} KB · {file.source === 'quote_request' ? 'Snapshot da solicitação' : file.uploadStatus === 'cancelled' ? 'Envio cancelado' : file.archived ? 'Arquivado' : file.uploadStatus === 'pending' ? 'Envio pendente' : file.uploadStatus === 'rejected' ? 'Envio recusado' : file.visibleToClient ? 'Compartilhado com o cliente' : 'Interno da equipe'}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {file.uploadStatus === 'ready' || file.uploadStatus === undefined ? <OrderFileDownload file={file} atelierId={atelierId!} orderId={orderId} /> : null}
        {canManage && file.source !== 'quote_request' && file.uploadStatus === 'ready' ? <><Button disabled={busy || file.archived} variant="secondary" onClick={() => void access(file, !file.visibleToClient, false)}>{file.visibleToClient ? 'Tornar interno' : 'Compartilhar'}</Button><Button disabled={busy} variant="secondary" onClick={() => void access(file, false, !file.archived)}>{file.archived ? 'Restaurar interno' : 'Arquivar'}</Button></> : null}
        {canManage && file.source !== 'quote_request' && ['pending', 'rejected'].includes(file.uploadStatus ?? '') ? <Button disabled={busy} variant="secondary" onClick={() => void access(file, false, true)}>Cancelar envio</Button> : null}
      </div>
    </li>)}</ul> : <p className="text-sm text-slate-500">Este pedido ainda não tem arquivos registrados.</p>}</CardContent></Card>
  </section>;
}
