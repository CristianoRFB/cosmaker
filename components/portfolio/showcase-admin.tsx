'use client';
import Link from 'next/link';
import { cloneElement, useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/providers/tenant-provider';
import { listAtelierShowcase, saveShowcaseContent, saveAtelierPublicProfile, uploadShowcaseImage, removeShowcaseImage } from '@/repositories/portfolio.repository';
import type { AtelierShowcase, AtelierShowcaseItem, PublicShowcaseProfile, ShowcaseContentInput, ShowcaseSection } from '@/types/portfolio';
import { ShowcaseImage } from './showcase-image';
import { showcaseCategoryLabels } from '@/constants/showcase';
const blank = (): ShowcaseContentInput => ({ title: '', description: '', category: 'full_cosplay', public: false, active: true, sortOrder: 0, internalNotes: '', version: 0, character: '', franchise: '', featured: false });
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.';
export function ShowcaseAdmin({ section, selectedId, startNew = false }: { section: ShowcaseSection; selectedId?: string; startNew?: boolean }) {
  const { atelierId, loading: tenantLoading, membershipValid, hasPermission } = useTenant();
  const canRead = membershipValid && (section === 'portfolio' ? hasPermission('portfolio:manage') : hasPermission('services:read') || hasPermission('services:write'));
  const canWrite = section === 'portfolio' ? hasPermission('portfolio:manage') : hasPermission('services:write');
  const [workspace, setWorkspace] = useState<AtelierShowcase | null>(null);
  const [profile, setProfile] = useState<PublicShowcaseProfile | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(false); const [editing, setEditing] = useState<AtelierShowcaseItem | null>(null);
  const [form, setForm] = useState(blank); const [captions, setCaptions] = useState<Record<string, string>>({});
  const keys = useRef({ fingerprint: '', id: '' }); const handledRoute = useRef('');
  const generation = useRef(0); const invalidate = useCallback(() => { generation.current++; }, []);
  const load = useCallback(async () => {
    const current = ++generation.current; setLoading(true); setError('');
    try { const data = await listAtelierShowcase(section); if (generation.current === current) { setWorkspace(data); setProfile(data.profile); } }
    catch (err) { if (generation.current === current) { setWorkspace(null); setError(errorMessage(err)); } }
    finally { if (generation.current === current) setLoading(false); }
  }, [section]);
  useEffect(() => { setWorkspace(null); setProfile(null); setDialog(false); setNotice(''); handledRoute.current = ''; if (!tenantLoading && canRead && atelierId) void load(); else setLoading(false); return invalidate; }, [tenantLoading, canRead, atelierId, load, invalidate]);
  function open(item: AtelierShowcaseItem | null) {
    setEditing(item); setForm(item ? { title: item.title, description: item.description, category: item.category, public: item.public, active: item.active, sortOrder: item.sortOrder, internalNotes: item.internalNotes, version: item.version, character: item.character ?? '', franchise: item.franchise ?? '', featured: item.featured === true } : blank());
    keys.current = { fingerprint: '', id: '' }; setError(''); setDialog(true);
  }
  useEffect(() => {
    const route = `${atelierId}:${selectedId ?? ''}:${startNew}`;
    if (!workspace || !canWrite || handledRoute.current === route) return;
    handledRoute.current = route;
    if (startNew) open(null);
    else if (selectedId) { const item = workspace.items.find((item) => item.id === selectedId); if (item) open(item); else setError('O conteúdo não pertence a este ateliê.'); }
  }, [workspace, selectedId, startNew, canWrite, atelierId]);
  function requestId(payload: unknown) { const fingerprint = JSON.stringify(payload); if (keys.current.fingerprint !== fingerprint) keys.current = { fingerprint, id: crypto.randomUUID() }; return keys.current.id; }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const { character: _character, franchise: _franchise, featured: _featured, ...service } = form;
      void _character; void _franchise; void _featured;
      const input = section === 'services' ? service : form;
      await saveShowcaseContent(section, input, editing?.id, requestId([section, editing?.id, input]));
      setDialog(false); setNotice('Conteúdo salvo. A publicação segue a configuração do ateliê.'); await load();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function upload(item: AtelierShowcaseItem, file: File) {
    setBusy(true); setError('');
    try {
      await uploadShowcaseImage(item.id, requestId(['image', item.id, item.version, file.name, file.size, file.lastModified, captions[item.id] ?? '']), item.version, captions[item.id] ?? '', file);
      setNotice('Imagem enviada com acesso controlado. Publique o projeto quando estiver pronto.'); await load();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function remove(item: AtelierShowcaseItem, imageId: string) {
    setBusy(true); setError('');
    try { await removeShowcaseImage(item.id, imageId, item.version, requestId(['remove', item.id, imageId, item.version])); setNotice('Imagem retirada da galeria. Projetos sem fotos ficam privados.'); await load(); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function saveProfile(event: FormEvent) {
    event.preventDefault(); if (!profile || busy) return; setBusy(true); setError('');
    try { await saveAtelierPublicProfile(profile, requestId(['profile', profile])); setNotice('Identidade e publicação atualizadas.'); await load(); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  if (tenantLoading) return <Skeleton className="h-80 rounded-2xl" />;
  if (!canRead) return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Seu perfil não tem permissão para acessar este conteúdo do ateliê.</p>;
  return <section className="grid min-w-0 gap-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-950">{section === 'services' ? 'Serviços do ateliê' : 'Portfólio do ateliê'}</h1><p className="mt-1 text-sm text-slate-600">Organize sua apresentação comercial e escolha o que será publicado.</p></div>{canWrite && <Button disabled={busy || loading || !workspace} onClick={() => open(null)}>{section === 'services' ? 'Novo serviço' : 'Novo projeto'}</Button>}</div>
    <nav aria-label="Conteúdo comercial" className="flex flex-wrap gap-3 text-sm font-semibold text-violet-700"><Link href="/atelier/servicos">Serviços</Link><Link href="/atelier/portfolio">Portfólio</Link>{profile && <Link href={`/${encodeURIComponent(profile.slug)}`} target="_blank" rel="noreferrer">Abrir página pública</Link>}</nav>
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {loading ? <Skeleton className="h-64 rounded-2xl" /> : <div className="grid gap-5 xl:grid-cols-2">{workspace?.items.length ? workspace.items.map((item) => <Card key={item.id}><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{item.title}</CardTitle><span className={`rounded-lg px-2 py-1 text-xs font-semibold ${item.public && item.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{!item.active ? 'Arquivado' : item.public ? 'Publicado' : 'Privado'}</span></div></CardHeader><CardContent><p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{item.description}</p><p className="mt-3 text-xs text-slate-500">{showcaseCategoryLabels[item.category]} · Ordem {item.sortOrder} · Versão {item.version}</p>{item.internalNotes && <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Nota interna: {item.internalNotes}</p>}{canWrite && <Button className="mt-4" variant="secondary" disabled={busy} onClick={() => open(item)}>Editar {section === 'services' ? 'serviço' : 'projeto'}</Button>}
      {section === 'portfolio' && <div className="mt-5 grid gap-4"><div className="grid gap-3 sm:grid-cols-2">{item.images?.map((image) => <div className="min-w-0" key={image.id}><ShowcaseImage projectId={item.id} imageId={image.id} caption={image.caption || item.title} /><p className="mt-1 break-words text-xs text-slate-500">{image.caption}</p>{canWrite && <Button className="mt-2" variant="secondary" disabled={busy} onClick={() => void remove(item, image.id)}>Retirar imagem</Button>}</div>)}</div>{canWrite && item.active && <div className="grid gap-3 rounded-xl border border-dashed border-violet-200 p-4"><Field label={`Legenda para ${item.title}`}><Input value={captions[item.id] ?? ''} maxLength={180} onChange={(event) => setCaptions((current) => ({ ...current, [item.id]: event.target.value }))} /></Field><Field label={`Adicionar foto em ${item.title}`}><Input disabled={busy || (item.images?.length ?? 0) >= 8} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(item, file); }} /></Field><p className="text-xs text-slate-500">JPEG, PNG ou WebP, até 10 MB. Publique o projeto após revisar as fotos.</p></div>}</div>}
    </CardContent></Card>) : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">Nenhum conteúdo cadastrado nesta seção.</p>}</div>}
    {profile && hasPermission('atelier:settings') && <Card><CardHeader><CardTitle>Identidade e publicação</CardTitle></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-2" onSubmit={saveProfile}><Field label="Nome público"><Input required minLength={3} maxLength={100} value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></Field><Field label="Cor da marca"><Input type="color" required value={profile.brandColor} onChange={(event) => setProfile({ ...profile, brandColor: event.target.value })} /></Field><Field label="Apresentação curta" wide><Input maxLength={180} value={profile.tagline} onChange={(event) => setProfile({ ...profile, tagline: event.target.value })} /></Field><label className="flex min-h-11 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={profile.published} onChange={(event) => setProfile({ ...profile, published: event.target.checked })} />Publicar página do ateliê</label><label className="flex min-h-11 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={profile.quoteRequestsEnabled} onChange={(event) => setProfile({ ...profile, quoteRequestsEnabled: event.target.checked })} />Receber solicitações de orçamento</label><div className="sm:col-span-2"><Button type="submit" disabled={busy}>Salvar identidade e publicação</Button></div></form></CardContent></Card>}
    {dialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3" onKeyDown={(event) => { if (event.key === 'Escape' && !busy) setDialog(false); }}><section role="dialog" aria-modal="true" aria-labelledby="showcase-dialog-title" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><h2 id="showcase-dialog-title" className="text-xl font-bold text-slate-950">{editing ? 'Editar conteúdo' : section === 'services' ? 'Novo serviço' : 'Novo projeto'}</h2><form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={save}><Field label="Título" wide><Input autoFocus required minLength={3} maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field><Field label="Descrição pública" wide><textarea className="min-h-28 rounded-xl border border-slate-300 p-3 text-sm" required minLength={10} maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field><Field label="Categoria"><select className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{Object.entries(showcaseCategoryLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></Field><Field label="Ordem de exibição"><Input type="number" required min={0} max={1000000} value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} /></Field>{section === 'portfolio' && <><Field label="Personagem"><Input maxLength={120} value={form.character} onChange={(event) => setForm({ ...form, character: event.target.value })} /></Field><Field label="Universo / franquia"><Input maxLength={120} value={form.franchise} onChange={(event) => setForm({ ...form, franchise: event.target.value })} /></Field><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} />Destacar projeto</label></>}
      <Field label="Nota interna" wide><textarea className="min-h-20 rounded-xl border border-slate-300 p-3 text-sm" maxLength={1000} value={form.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })} /></Field><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={!form.active} onChange={(event) => setForm({ ...form, active: !event.target.checked, ...(event.target.checked ? { public: false } : {}) })} />Arquivar conteúdo</label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={!form.active || (section === 'portfolio' && !editing?.images?.length)} checked={form.public} onChange={(event) => setForm({ ...form, public: event.target.checked })} />Publicar conteúdo</label>{section === 'portfolio' && !editing?.images?.length && <p className="text-xs text-slate-500 sm:col-span-2">Salve o projeto privado, adicione uma foto e depois publique.</p>}{error && <p role="alert" className="text-sm text-rose-700 sm:col-span-2">{error}</p>}<div className="flex justify-end gap-3 sm:col-span-2"><Button variant="secondary" disabled={busy} onClick={() => setDialog(false)}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar conteúdo'}</Button></div></form></section></div>}
  </section>;
}
function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  const id = useId(); return <div className={`grid min-w-0 gap-1.5 text-sm font-medium text-slate-700 ${wide ? 'sm:col-span-2' : ''}`}><label htmlFor={id}>{label}</label>{cloneElement(children as ReactElement<{ id?: string }>, { id })}</div>;
}
