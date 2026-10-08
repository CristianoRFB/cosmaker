'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CircleDollarSign, Search } from 'lucide-react';
import { listPlatformAteliers, type PlatformAtelier } from '@/repositories/admin.repository';
import { formatPlatformDate } from '@/lib/admin/format-admin';
import { AdminLoadError } from '@/components/admin/admin-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '@/components/ui/table';

function statusTone(status: string | null) {
  if (status === 'active') return 'green' as const;
  if (status === 'trial' || status === 'demo') return 'violet' as const;
  if (status === 'past_due') return 'amber' as const;
  if (status === 'suspended' || status === 'cancelled') return 'red' as const;
  return 'neutral' as const;
}

function statusLabel(status: string | null) {
  return ({ active: 'Ativo', trial: 'Trial', demo: 'Demonstração', past_due: 'Pendente', suspended: 'Suspenso comercialmente', cancelled: 'Cancelado' } as Record<string, string>)[status ?? ''] ?? 'Atribuição pendente';
}

export default function AssinaturasPage() {
  const [ateliers, setAteliers] = useState<PlatformAtelier[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (cursor: string | null = null, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const result = await listPlatformAteliers(cursor);
      setAteliers((previous) => append ? [...previous, ...result.ateliers] : result.ateliers);
      setNextCursor(result.nextCursor);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Confira a conexão e tente novamente.'); }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const pending = useMemo(() => ateliers.filter((item) => item.commercial.assignment === 'pending_assignment').length, [ateliers]);
  const active = useMemo(() => ateliers.filter((item) => item.commercial.subscriptionStatus === 'active').length, [ateliers]);
  const trials = useMemo(() => ateliers.filter((item) => item.commercial.subscriptionStatus === 'trial').length, [ateliers]);
  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    return needle ? ateliers.filter((item) => [item.name, item.email, item.id, item.commercial.planId, item.commercial.subscriptionStatus].some((value) => value?.toLocaleLowerCase('pt-BR').includes(needle))) : ateliers;
  }, [ateliers, search]);

  if (loading) return <div className="grid gap-4"><div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((item) => <Skeleton className="h-24 rounded-2xl" key={item} />)}</div><Skeleton className="h-96 rounded-2xl" /></div>;
  if (error && !ateliers.length) return <AdminLoadError message={error} onRetry={() => void load()} />;

  return <div className="grid gap-5">
    <p className="max-w-3xl text-sm leading-6 text-slate-600">Estado comercial atribuído manualmente pelo Platform Owner. Tenants legados sem atribuição permanecem identificados como pendentes; os dados e fluxos principais não são alterados por essa ausência.</p>
    {error ? <AdminLoadError message={error} onRetry={() => void load()} /> : null}
    <section aria-label="Resumo das assinaturas" className="grid gap-4 sm:grid-cols-3">{[
      { label: 'Ativos', value: active, detail: 'Status comercial ativo' },
      { label: 'Trials', value: trials, detail: 'Premium por 14 dias' },
      { label: 'Atribuição pendente', value: pending, detail: 'Sem plano comercial atribuído' },
    ].map((item) => <Card key={item.label}><CardContent className="p-5"><p className="text-sm text-slate-500">{item.label}</p><p className="mt-1 text-2xl font-bold">{item.value.toLocaleString('pt-BR')}</p><p className="mt-1 text-xs text-slate-500">{item.detail} · página carregada</p></CardContent></Card>)}</section>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><CircleDollarSign className="text-violet-700" size={19} />Assinaturas e estados</CardTitle></CardHeader><CardContent>
      <div className="relative mb-4 max-w-md"><Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><Input aria-label="Buscar assinatura" className="pl-10" onChange={(event) => setSearch(event.target.value)} placeholder="Nome, e-mail ou estado" value={search} /></div>
      {visible.length === 0 ? <EmptyState title={search ? 'Nenhum resultado' : 'Nenhum tenant carregado'} description={search ? 'Altere a busca e tente novamente.' : 'Cadastre ateliês para visualizar seus estados comerciais.'} /> : <Table><TableHead><tr><TableHeader>Tenant</TableHeader><TableHeader>Plano</TableHeader><TableHeader>Estado comercial</TableHeader><TableHeader>Trial até</TableHeader><TableHeader>Operação</TableHeader><TableHeader><span className="sr-only">Detalhe</span></TableHeader></tr></TableHead><TableBody>{visible.map((item) => <tr key={item.id}>
        <TableCell><Link className="font-semibold text-slate-900 hover:text-violet-800" href={`/admin/ateliers/${encodeURIComponent(item.id)}`}>{item.name}</Link><span className="mt-1 block font-mono text-[11px] text-slate-500">{item.id}</span></TableCell>
        <TableCell className="capitalize">{item.commercial.planId ?? (item.plan ? `${item.plan} · legado` : '—')}</TableCell>
        <TableCell><Badge tone={statusTone(item.commercial.subscriptionStatus)}>{statusLabel(item.commercial.subscriptionStatus)}</Badge>{item.commercial.demoWorkspace ? <Badge className="ml-1" tone="violet">Premium Demo</Badge> : null}</TableCell>
        <TableCell className="text-slate-600">{item.commercial.trialUntil ? formatPlatformDate(item.commercial.trialUntil) : '—'}</TableCell>
        <TableCell className="text-sm text-slate-600">Manual pelo Platform Owner</TableCell>
        <TableCell><Link aria-label={`Gerenciar ${item.name}`} className="grid size-9 place-items-center rounded-lg text-violet-700 hover:bg-violet-50" href={`/admin/ateliers/${encodeURIComponent(item.id)}`}><ArrowRight size={17} /></Link></TableCell>
      </tr>)}</TableBody></Table>}
      {nextCursor ? <div className="mt-5 flex justify-center"><Button disabled={loadingMore} onClick={() => void load(nextCursor, true)} variant="secondary">{loadingMore ? 'Carregando…' : 'Carregar mais tenants'}</Button></div> : null}
      <p className="mt-4 text-xs leading-5 text-slate-500">Nenhuma cobrança, renovação automática ou checkout está conectado. Valores vêm do catálogo local na tela de planos.</p>
    </CardContent></Card>
  </div>;
}
