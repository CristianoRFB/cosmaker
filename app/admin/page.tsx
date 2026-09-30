'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowRight, Building2, CircleDollarSign, UsersRound } from 'lucide-react';
import { getPlatformOverview, type PlatformOverview } from '@/repositories/admin.repository';
import { formatPlatformAction, formatPlatformDate } from '@/lib/admin/format-admin';
import { AdminLoadError } from '@/components/admin/admin-feedback';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Confira a conexão com o Firebase e as Cloud Functions.';
}

export default function PlatformAdminDashboard() {
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await getPlatformOverview()); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="grid gap-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton className="h-32 rounded-2xl" key={item} />)}</div><Skeleton className="h-80 rounded-2xl" /></div>;
  if (error) return <AdminLoadError message={error} onRetry={() => void load()} />;
  if (!data) return null;

  const cards = [
    { label: 'Ateliês cadastrados', value: data.totals.ateliers, detail: `${data.totals.activeAteliers} ativos · ${data.totals.suspendedAteliers} suspensos`, icon: Building2, color: 'text-violet-700 bg-violet-100' },
    { label: 'Usuários', value: data.totals.users, detail: 'Contas registradas na plataforma', icon: UsersRound, color: 'text-fuchsia-700 bg-fuchsia-100' },
    { label: 'Assinaturas ativas', value: data.totals.activeSubscriptions, detail: 'Status consultado no cadastro de assinaturas', icon: CircleDollarSign, color: 'text-emerald-700 bg-emerald-100' },
    { label: 'Atividade recente', value: data.recentActivity.length, detail: 'Eventos mais recentes na trilha de auditoria', icon: Activity, color: 'text-amber-700 bg-amber-100' },
  ];

  return <div className="grid gap-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm leading-6 text-slate-600">Operação da plataforma, com métricas lidas diretamente do Firestore por funções administrativas protegidas.</p></div><Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800" href="/admin/ateliers">Gerenciar ateliês<ArrowRight size={16} /></Link></div>
    <section aria-label="Indicadores da plataforma" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, detail, icon: Icon, color }) => <Card key={label}><CardContent className="flex items-start justify-between gap-3 p-5 sm:p-6"><div className="min-w-0"><p className="text-sm font-medium text-slate-600">{label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value.toLocaleString('pt-BR')}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${color}`}><Icon size={19} /></span></CardContent></Card>)}
    </section>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle>Auditoria recente</CardTitle><p className="mt-1 text-sm text-slate-500">Ações administrativas e alterações críticas registradas pelo sistema.</p></div><Link className="shrink-0 text-sm font-semibold text-violet-700 hover:text-violet-900" href="/admin/logs">Ver trilha completa</Link></CardHeader>
      <CardContent>
        {data.recentActivity.length === 0 ? <EmptyState title="Ainda não há atividade registrada" description="A trilha de auditoria aparecerá aqui conforme as operações da plataforma forem realizadas." /> : <div className="divide-y divide-slate-100">{data.recentActivity.map((entry) => <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" key={entry.id}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{formatPlatformAction(entry.action)}</p><Badge tone="violet">{entry.entity}</Badge></div><p className="mt-1 truncate text-xs text-slate-500">Responsável {entry.actorId || 'não informado'}{entry.atelierId ? ` · Ateliê ${entry.atelierId}` : ''}</p></div><time className="shrink-0 text-xs text-slate-500">{formatPlatformDate(entry.timestamp)}</time></div>)}</div>}
      </CardContent>
    </Card>
  </div>;
}
