'use client';
import Link from 'next/link';
import { cloneElement, useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/providers/tenant-provider';
import { getOperationalPreferences, saveOperationalPreferences } from '@/repositories/reports.repository';
import { saveAtelierPublicProfile } from '@/repositories/portfolio.repository';
import type { OperationalPreferencesResponse } from '@/types/report';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível salvar as configurações.';
export function OperationalSettings() {
  const { atelierId, membershipValid, loading: tenantLoading, hasPermission } = useTenant();
  const canEditNow = hasPermission('atelier:settings');
  const [data, setData] = useState<OperationalPreferencesResponse | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const keys = useRef({ fingerprint: '', id: '' });
  const epoch = useRef(0); const invalidate = useCallback(() => { epoch.current++; }, []);
  const load = useCallback(async () => { const current = ++epoch.current; setLoading(true); setError(''); try { const result = await getOperationalPreferences(); if (current === epoch.current) setData(result); } catch (err) { if (current === epoch.current) { setData(null); setError(errorMessage(err)); } } finally { if (current === epoch.current) setLoading(false); } }, []);
  useEffect(() => { setData(null); setNotice(''); if (!tenantLoading && membershipValid && atelierId) void load(); else setLoading(false); return invalidate; }, [tenantLoading, membershipValid, atelierId, canEditNow, load, invalidate]);
  async function save(event: FormEvent, identity = false) {
    event.preventDefault(); if (!data?.canEdit || !canEditNow || busy) return; setBusy(true); setError(''); setNotice('');
    try {
      const payload = identity ? data.publicProfile : data.preferences; const fingerprint = JSON.stringify([identity, payload]);
      if (keys.current.fingerprint !== fingerprint) keys.current = { fingerprint, id: crypto.randomUUID() };
      if (identity && data.publicProfile) await saveAtelierPublicProfile(data.publicProfile, keys.current.id); else await saveOperationalPreferences(data.preferences, keys.current.id);
      setNotice(identity ? 'Identidade pública atualizada.' : 'Preferências operacionais salvas.'); await load();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  if (tenantLoading || loading) return <Skeleton className="h-80 rounded-2xl" />;
  if (!membershipValid) return <p className="text-sm text-amber-800">O perfil não tem vínculo ativo com este ateliê.</p>;
  return <section className="grid gap-5"><div><h1 className="text-2xl font-bold text-slate-950">Configurações operacionais</h1><p className="mt-1 text-sm text-slate-600">Preferências dos relatórios e apresentação pública do seu ateliê.</p></div><nav className="flex flex-wrap gap-3 text-sm font-semibold text-violet-700" aria-label="Configurações do ateliê"><Link href="/atelier/relatorios">Relatórios</Link><Link href="/atelier/agenda">Agenda e capacidade</Link><Link href="/atelier/equipe">Equipe e permissões</Link><Link href="/atelier/configuracoes/notificacoes">Notificações internas</Link></nav>
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {data && <><Card><CardHeader><CardTitle>Relatórios e período padrão</CardTitle></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void save(event)}><Field label="Fuso horário"><Input required maxLength={80} disabled={!data.canEdit || !canEditNow || busy} value={data.preferences.timezone} onChange={(event) => setData({ ...data, preferences: { ...data.preferences, timezone: event.target.value } })} /></Field><Field label="Dias do período padrão"><Input required type="number" min={1} max={366} disabled={!data.canEdit || !canEditNow || busy} value={data.preferences.defaultReportDays} onChange={(event) => setData({ ...data, preferences: { ...data.preferences, defaultReportDays: Number(event.target.value) } })} /></Field><label className="flex min-h-11 items-center gap-2 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" disabled={!data.canEdit || !canEditNow || busy} checked={data.preferences.includeCancelledOrders} onChange={(event) => setData({ ...data, preferences: { ...data.preferences, includeCancelledOrders: event.target.checked } })} />Incluir cancelados e reversões nos indicadores de pedidos</label><p className="text-xs leading-5 text-slate-500 sm:col-span-2">O fuso define os dias dos relatórios. Mudanças não reagendam compromissos existentes. Custos e receitas seguem o financeiro em centavos de reais.</p>{data.canEdit && canEditNow ? <Button type="submit" disabled={busy} className="justify-self-start">Salvar preferências</Button> : <p className="text-sm text-slate-500">Alterações exigem a permissão de configurações do ateliê.</p>}</form></CardContent></Card>
      {data.publicProfile && data.canEdit && canEditNow && <Card><CardHeader><CardTitle>Identidade e publicação</CardTitle></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void save(event, true)}><Field label="Nome público"><Input required minLength={3} maxLength={100} value={data.publicProfile.name} onChange={(event) => setData({ ...data, publicProfile: { ...data.publicProfile!, name: event.target.value } })} /></Field><Field label="Cor da marca"><Input type="color" value={data.publicProfile.brandColor} onChange={(event) => setData({ ...data, publicProfile: { ...data.publicProfile!, brandColor: event.target.value } })} /></Field><Field label="Apresentação curta"><Input maxLength={180} value={data.publicProfile.tagline} onChange={(event) => setData({ ...data, publicProfile: { ...data.publicProfile!, tagline: event.target.value } })} /></Field><div className="flex flex-wrap items-center gap-4"><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={data.publicProfile.published} onChange={(event) => setData({ ...data, publicProfile: { ...data.publicProfile!, published: event.target.checked } })} />Publicar página</label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={data.publicProfile.quoteRequestsEnabled} onChange={(event) => setData({ ...data, publicProfile: { ...data.publicProfile!, quoteRequestsEnabled: event.target.checked } })} />Receber orçamentos</label></div><Button className="justify-self-start" type="submit" disabled={busy}>Salvar identidade pública</Button><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-violet-700" href={`/${encodeURIComponent(data.publicProfile.slug)}`} target="_blank" rel="noreferrer">Abrir página pública →</Link></form></CardContent></Card>}
    </>}
  </section>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { const id = useId(); return <div className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700"><label htmlFor={id}>{label}</label>{cloneElement(children as ReactElement<{ id?: string }>, { id })}</div>; }
