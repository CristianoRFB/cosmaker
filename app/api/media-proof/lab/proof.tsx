'use client';
import { useState } from 'react';
import Image from 'next/image';
type Asset = { id: string; tenant: string; state: string; size: number; mime: string; mediaClass: string; notices: Record<string, { failed?: boolean; recordedAt?: string }>; retention: { noAutoDelete: boolean; reason?: string; dueAt?: string; graceUntil?: string } };
type Governance = { settings: { uploadsPaused: boolean }; meter: { active: number; pending: number; egressEstimated: number } | null; billableTelemetry: string; mode: string };
const sizeLabel = (size: number) => `${(size / 1024 / 1024).toFixed(2)} MiB (${size.toLocaleString('pt-BR')} bytes)`;
const dateLabel = (value?: string) => value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'UTC' }) + ' UTC' : 'Sem vencimento automático';
export function MediaProof() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [token, setToken] = useState('');
  const [orderId, setOrderId] = useState(''), [file, setFile] = useState<File | null>(null), [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false), [status, setStatus] = useState('Entre com uma conta fictícia.'), [error, setError] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]), [governance, setGovernance] = useState<Governance | null>(null), [thumbnail, setThumbnail] = useState(''), [thumbnailOptIn, setThumbnailOptIn] = useState(false);
  async function api(path: string, init: RequestInit = {}, auth = token) {
    const r = await fetch('/api/media-proof/' + path, { ...init, headers: { Authorization: 'Bearer ' + auth, ...init.headers } });
    if (!r.ok) { const j = await r.json().catch(() => null); throw Error(j?.error?.message || `Operação recusada (${r.status}).`); }
    return r;
  }
  async function action(fn: () => Promise<void>) { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Falha na operação.'); } finally { setBusy(false); } }
  async function refresh(auth = token) { setAssets((await (await api('assets', {}, auth)).json()).data); }
  async function login() { await action(async () => {
    const r = await fetch('/api/media-proof/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const j = await r.json(); if (!r.ok) throw Error(j.error?.message || 'Login recusado.'); setToken(j.data.token); setPassword('');
    const global = await fetch('/api/media-proof/governance', { headers: { Authorization: 'Bearer ' + j.data.token } });
    if (global.ok) { setGovernance((await global.json()).data); setAssets([]); } else if (global.status === 403) { setGovernance(null); await refresh(j.data.token); } else throw Error('Não foi possível verificar a autorização.');
    setStatus('Sessão sintética verificada.');
  }); }
  async function previewOriginal(original: File) {
    // Opt-in local PNG only; check IHDR bounds before browser decode. Never replace the original.
    if (original.type !== 'image/png') throw Error('Miniatura local comprovada somente para PNG; original preservado.');
    const head = new DataView(await original.slice(0, 24).arrayBuffer());
    if (head.byteLength < 24 || head.getUint32(0) !== 0x89504e47 || head.getUint32(4) !== 0x0d0a1a0a || head.getUint32(12) !== 0x49484452) throw Error('PNG inválido.');
    const width = head.getUint32(16), height = head.getUint32(20); if (!width || !height || width * height > 16_000_000 || width > 8192 || height > 8192) throw Error('Imagem excede o limite seguro de prévia local.');
    const bitmap = await createImageBitmap(original, { resizeWidth: Math.min(512, width) });
    try { const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; canvas.getContext('2d')?.drawImage(bitmap, 0, 0); setThumbnail(canvas.toDataURL('image/png')); } finally { bitmap.close(); }
  }
  async function upload() { await action(async () => {
    if (!file || !orderId) throw Error('Selecione arquivo e pedido.');
    if (file.size < 1 || file.size > 20 * 1024 * 1024) throw Error('Arquivo deve conter de 1 byte a 20 MiB inteiros.');
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw Error('Use PDF, PNG, JPEG ou WebP. SVG/GIF/ZIP não aceitos.');
    if (thumbnailOptIn) await previewOriginal(file);
    const bytes = await file.arrayBuffer(), digest = await crypto.subtle.digest('SHA-256', bytes), sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    const created = (await (await api('assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: crypto.randomUUID(), orderId, size: file.size, mime: file.type, sha256, shared }) })).json()).data;
    if (created.upload) throw Error('TUS hospedado ainda não habilitado nesta interface; nenhuma troca automática de provedor.');
    for (let offset = 0, index = 0; offset < bytes.byteLength; offset += 512 * 1024, index++) {
      setStatus(`Enviando bloco ${index + 1} de ${Math.ceil(bytes.byteLength / (512 * 1024))}…`);
      await api(`assets/${created.tenant}/${created.id}/part`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'x-media-fence': String(created.fence), 'x-media-part': String(index) }, body: bytes.slice(offset, offset + 512 * 1024) });
    }
    await api(`assets/${created.tenant}/${created.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fence: created.fence }) });
    await refresh(); setStatus('Arquivo persistido e SHA-256 conferido. Original preservado.');
  }); }
  async function download(a: Asset) { await action(async () => {
    const r = await api(`assets/${a.tenant}/${a.id}/download`), blob = await r.blob();
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()), hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    if (blob.size !== a.size || hash !== r.headers.get('x-content-sha256')) throw Error('Download falhou na conferência de integridade.');
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = a.id + (({ 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }[a.mime] || '.bin')); link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); setStatus('Download individual concluído.');
  }); }
  return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-8">
    <h1 className="text-2xl font-semibold">Prova local de mídia privada</h1>
    <p>Ambiente sintético demo-cosmaker. Migração OFF. Exclusão DRY_RUN. Sem uso de contas ou arquivos reais.</p>
    <form className="grid gap-3 rounded-xl border p-4" onSubmit={e => { e.preventDefault(); void login(); }}>
      <label>E-mail fictício<input className="mt-1 block min-h-11 w-full rounded border p-2" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" /></label>
      <label>Senha fictícia<input className="mt-1 block min-h-11 w-full rounded border p-2" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></label>
      <button className="min-h-11 rounded bg-slate-900 px-4 text-white disabled:opacity-50" disabled={busy}>Entrar no laboratório</button>
    </form>
    <p role="status" aria-live="polite">{busy ? 'Operação em andamento. ' : ''}{status}</p>{error && <p role="alert" className="rounded border border-red-400 p-3 text-red-800">{error}</p>}
    {token && !governance && <>
      <form className="grid min-w-0 gap-3 rounded-xl border p-4" onSubmit={e => { e.preventDefault(); void upload(); }}>
        <h2 className="text-lg font-semibold">Novo arquivo do pedido</h2>
        <label>Pedido<input className="mt-1 block min-h-11 w-full rounded border p-2" value={orderId} onChange={e => setOrderId(e.target.value)} required /></label>
        <label>Arquivo (até 20 MiB)<input className="mt-1 block min-h-11 w-full min-w-0 max-w-full text-sm" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e => { setFile(e.target.files?.[0] || null); setThumbnail(''); }} required /></label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} />Compartilhar com o cliente do pedido</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={thumbnailOptIn} onChange={e => setThumbnailOptIn(e.target.checked)} />Gerar prévia PNG local, sem alterar original</label>
        {file && <p>{sizeLabel(file.size)}</p>}{thumbnail && <Image unoptimized alt="Prévia local opcional" src={thumbnail} width={512} height={512} className="max-h-48 max-w-full object-contain" />}
        <button className="min-h-11 rounded bg-slate-900 px-4 text-white disabled:opacity-50" disabled={busy}>Enviar e conferir integridade</button>
      </form>
      <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-semibold">Arquivos autorizados</h2><button className="min-h-11 rounded border px-3" disabled={busy} onClick={() => void action(() => refresh())}>Atualizar</button></div>
      {assets.length === 0 && <p>Nenhum arquivo pronto neste ateliê.</p>}
      <ul className="space-y-3">{assets.map(a => <li key={a.id} data-testid="media-card" className="min-w-0 space-y-2 rounded-xl border p-4">
        <p className="break-all font-mono text-xs">{a.id}</p><p>{a.mediaClass} · {a.mime} · {sizeLabel(a.size)}</p>
        <p>Vencimento: {dateLabel(a.retention.dueAt)}</p><p>Tolerância até: {dateLabel(a.retention.graceUntil)}</p>
        <p>{a.retention.noAutoDelete ? 'Exclusão automática bloqueada: ' + a.retention.reason : 'Retenção temporária; baixe antes do prazo. Rotina atual somente DRY_RUN.'}</p>
        {Object.entries(a.notices).map(([stage, n]) => <p key={stage}>{stage === 'warning' ? 'Aviso prévio' : 'Aviso de vencimento'}: {n.failed ? 'Falha no registro — exclusão adiada e uploads opcionais limitados.' : 'Registrado em ' + dateLabel(n.recordedAt)}</p>)}
        <button className="min-h-11 rounded border px-4 disabled:opacity-50" disabled={busy} onClick={() => void download(a)}>Baixar original / exportar individualmente</button>
      </li>)}</ul>
    </>}
    {governance && <section className="space-y-3 rounded-xl border p-4"><h2 className="text-xl font-semibold">Governança global</h2><p>Política v01 · {governance.mode} · Sem alteração de planos ou TTL.</p><p>Ativos: {sizeLabel(governance.meter?.active || 0)}. Pendentes: {sizeLabel(governance.meter?.pending || 0)}.</p><p>Downloads estimados: {sizeLabel(governance.meter?.egressEstimated || 0)}. Telemetria faturável do provedor não disponível localmente.</p><button disabled={busy} className="min-h-11 rounded border px-4" onClick={() => void action(async () => { await api('governance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadsPaused: !governance.settings.uploadsPaused }) }); setGovernance((await (await api('governance')).json()).data); setStatus('Pausa de novos uploads atualizada; leituras preservadas.'); })}>{governance.settings.uploadsPaused ? 'Retomar novos uploads' : 'Pausar novos uploads'}</button></section>}
  </main>;
}
