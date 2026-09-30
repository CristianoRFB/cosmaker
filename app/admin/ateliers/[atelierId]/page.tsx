'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Building2, ClipboardList, Mail, MapPin, Package, Phone, ShieldCheck, UsersRound } from 'lucide-react';
import { getPlatformAtelier, setPlatformAtelierStatus, type PlatformAtelierDetail } from '@/repositories/admin.repository';
import { formatPlatformDate, getAtelierStatus } from '@/lib/admin/format-admin';
import { AdminLoadError } from '@/components/admin/admin-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';

function message(error: unknown) { return error instanceof Error ? error.message : 'Confira a conexão com o Firebase e tente novamente.'; }

export default function PlatformAtelierDetailPage() {
  const params = useParams<{ atelierId: string }>();
  const atelierId = decodeURIComponent(params.atelierId);
  const [data, setData] = useState<PlatformAtelierDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await getPlatformAtelier(atelierId)); }
    catch (requestError) { setError(message(requestError)); }
    finally { setLoading(false); }
  }, [atelierId]);

  useEffect(() => { void load(); }, [load]);

  async function changeStatus() {
    if (!data) return;
    setSaving(true);
    setStatusError('');
    try {
      await setPlatformAtelierStatus(data.atelier.id, !data.atelier.active);
      setConfirmOpen(false);
      await load();
    } catch (requestError) { setStatusError(message(requestError)); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="grid gap-4"><Skeleton className="h-32 rounded-2xl" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton className="h-28 rounded-2xl" key={item} />)}</div></div>;
  if (error) return <div className="grid gap-4"><Link className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-violet-700" href="/admin/ateliers"><ArrowLeft size={16} />Voltar para ateliês</Link><AdminLoadError message={error} onRetry={() => void load()} /></div>;
  if (!data) return null;

  const { atelier, owner, counts, subscription } = data;
  const status = getAtelierStatus(atelier.active);
  const metrics = [
    { label: 'Membros', value: counts.members, icon: UsersRound },
    { label: 'Clientes', value: counts.clients, icon: UsersRound },
    { label: 'Pedidos', value: counts.orders, icon: Package },
    { label: 'Solicitações', value: counts.quoteRequests, icon: ClipboardList },
  ];

  return <div className="grid gap-6">
    <Link className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900" href="/admin/ateliers"><ArrowLeft size={16} />Todos os ateliês</Link>
    <Card className="overflow-hidden"><div className="h-1.5 bg-gradient-to-r from-violet-700 via-fuchsia-500 to-pink-400" /><CardContent className="flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-start sm:p-7"><div className="flex min-w-0 gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-800"><Building2 size={22} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-xl font-bold text-slate-950 sm:text-2xl">{atelier.name}</h2><Badge tone={status.tone}>{status.label}</Badge></div><p className="mt-1 font-mono text-xs text-slate-500">{atelier.id}</p>{atelier.description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{atelier.description}</p> : null}<div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">{atelier.city || atelier.state ? <span className="inline-flex items-center gap-1.5"><MapPin size={15} />{[atelier.city, atelier.state].filter(Boolean).join(' · ')}</span> : null}{atelier.email ? <a className="inline-flex items-center gap-1.5 hover:text-violet-800" href={`mailto:${atelier.email}`}><Mail size={15} />{atelier.email}</a> : null}{atelier.phone ? <a className="inline-flex items-center gap-1.5 hover:text-violet-800" href={`tel:${atelier.phone}`}><Phone size={15} />{atelier.phone}</a> : null}</div></div></div><Button className="shrink-0" disabled={saving} onClick={() => setConfirmOpen(true)} variant={atelier.active ? 'danger' : 'primary'}>{atelier.active ? 'Suspender ateliê' : 'Reativar ateliê'}</Button></CardContent></Card>
    {statusError ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900" role="alert">{statusError}</p> : null}
    <section aria-label="Indicadores do ateliê" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, icon: Icon }) => <Card key={label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value.toLocaleString('pt-BR')}</p></div><span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><Icon size={19} /></span></CardContent></Card>)}</section>
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Conta responsável</CardTitle><CardDescription>Perfil vinculado como proprietária ou proprietário do ateliê.</CardDescription></CardHeader><CardContent>{owner ? <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><UsersRound size={18} /></span><div><p className="font-semibold text-slate-900">{owner.name ?? 'Nome não informado'}</p><p className="mt-1 text-sm text-slate-600">{owner.email ?? 'E-mail não informado'}</p><p className="mt-2 font-mono text-xs text-slate-400">{owner.id}</p></div></div> : <p className="text-sm leading-6 text-slate-600">Nenhum perfil de proprietário foi vinculado ao cadastro.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Plano e ciclo</CardTitle><CardDescription>Informações da assinatura encontrada para este ateliê.</CardDescription></CardHeader><CardContent>{subscription ? <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck size={18} /></span><div><p className="font-semibold capitalize text-slate-900">{subscription.plan ?? atelier.plan ?? 'Plano sem identificação'}</p><p className="mt-1 text-sm capitalize text-slate-600">Situação: {subscription.status ?? 'não informada'}</p><p className="mt-1 text-sm text-slate-500">Próximo fim de ciclo: {formatPlatformDate(subscription.currentPeriodEnd)}</p></div></div> : <p className="text-sm leading-6 text-slate-600">Nenhuma assinatura foi vinculada. Plano cadastrado no ateliê: <span className="font-semibold capitalize">{atelier.plan ?? 'não informado'}</span>.</p>}</CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Registro do ateliê</CardTitle></CardHeader><CardContent className="grid gap-4 text-sm sm:grid-cols-2"><div><p className="text-slate-500">Criado em</p><p className="mt-1 font-medium text-slate-900">{formatPlatformDate(atelier.createdAt)}</p></div><div><p className="text-slate-500">Última atualização</p><p className="mt-1 font-medium text-slate-900">{formatPlatformDate(atelier.updatedAt)}</p></div></CardContent></Card>
    <ConfirmDialog confirmDisabled={saving} confirmLabel={saving ? 'Aplicando…' : atelier.active ? 'Suspender acesso' : 'Reativar acesso'} description={atelier.active ? 'O ateliê perderá acesso às rotas internas e o recebimento de novas solicitações públicas será interrompido. A ação ficará registrada na auditoria da plataforma.' : 'O acesso do ateliê será liberado novamente. A reativação ficará registrada na auditoria da plataforma.'} onClose={() => setConfirmOpen(false)} onConfirm={() => void changeStatus()} open={confirmOpen} title={atelier.active ? 'Suspender este ateliê?' : 'Reativar este ateliê?'} />
  </div>;
}
