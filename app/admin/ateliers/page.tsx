'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, Search } from 'lucide-react';
import { listPlatformAteliers, type PlatformAtelier } from '@/repositories/admin.repository';
import { getAtelierStatus, formatPlatformDate } from '@/lib/admin/format-admin';
import { AdminLoadError } from '@/components/admin/admin-feedback';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '@/components/ui/table';

function getError(error: unknown) { return error instanceof Error ? error.message : 'Confira a conexão e tente novamente.'; }

export default function PlatformAteliersPage() {
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
    } catch (requestError) { setError(getError(requestError)); }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const visibleAteliers = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    if (!needle) return ateliers;
    return ateliers.filter((atelier) => [atelier.name, atelier.slug, atelier.email, atelier.id].some((value) => value?.toLocaleLowerCase('pt-BR').includes(needle)));
  }, [ateliers, search]);

  if (loading) return <div className="grid gap-4"><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-[420px] rounded-2xl" /></div>;
  if (error && ateliers.length === 0) return <AdminLoadError message={error} onRetry={() => void load()} />;

  return <div className="grid gap-5">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><p className="max-w-2xl text-sm leading-6 text-slate-600">Consulte os ateliês cadastrados, seus planos e estado de acesso. A listagem é paginada e vem do banco da plataforma.</p><div className="relative w-full sm:max-w-sm"><Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><Input aria-label="Buscar ateliê" className="pl-10" onChange={(event) => setSearch(event.target.value)} placeholder="Nome, e-mail ou identificador" value={search} /></div></div>
    {error ? <AdminLoadError message={error} onRetry={() => void load()} /> : null}
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="text-violet-700" size={19} />Ateliês <span className="text-sm font-normal text-slate-500">({ateliers.length} carregados)</span></CardTitle></CardHeader>
      <CardContent>
        {visibleAteliers.length === 0 ? <EmptyState title={search ? 'Nenhum ateliê corresponde à busca' : 'Nenhum ateliê cadastrado'} description={search ? 'Revise o termo informado ou limpe a busca.' : 'Ateliês aparecerão aqui quando forem cadastrados na plataforma.'} /> : <Table>
          <TableHead><tr><TableHeader>Ateliê</TableHeader><TableHeader>Proprietário</TableHeader><TableHeader>Plano</TableHeader><TableHeader>Situação</TableHeader><TableHeader>Cadastro</TableHeader><TableHeader><span className="sr-only">Detalhes</span></TableHeader></tr></TableHead>
          <TableBody>{visibleAteliers.map((atelier) => { const status = getAtelierStatus(atelier.active); return <tr key={atelier.id}>
            <TableCell><Link className="group block min-w-44" href={`/admin/ateliers/${encodeURIComponent(atelier.id)}`}><span className="block font-semibold text-slate-900 group-hover:text-violet-800">{atelier.name}</span><span className="mt-1 block text-xs text-slate-500">{atelier.slug ? `/${atelier.slug}` : atelier.id}</span></Link></TableCell>
            <TableCell><span className="block max-w-48 truncate text-sm text-slate-700">{atelier.email ?? 'E-mail não informado'}</span><span className="mt-1 block font-mono text-[11px] text-slate-400">{atelier.ownerId ?? 'Proprietário não vinculado'}</span></TableCell>
            <TableCell className="capitalize text-slate-700">{atelier.plan ?? 'Sem plano'}</TableCell>
            <TableCell><Badge tone={status.tone}>{status.label}</Badge></TableCell>
            <TableCell className="whitespace-nowrap text-slate-600">{formatPlatformDate(atelier.createdAt)}</TableCell>
            <TableCell><Link aria-label={`Abrir ${atelier.name}`} className="grid size-9 place-items-center rounded-lg text-violet-700 hover:bg-violet-50" href={`/admin/ateliers/${encodeURIComponent(atelier.id)}`}><ArrowRight size={17} /></Link></TableCell>
          </tr>; })}</TableBody>
        </Table>}
        {nextCursor ? <div className="mt-5 flex justify-center"><button className="min-h-11 rounded-xl border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-50" disabled={loadingMore} onClick={() => void load(nextCursor, true)} type="button">{loadingMore ? 'Carregando…' : 'Carregar mais ateliês'}</button></div> : null}
      </CardContent>
    </Card>
  </div>;
}
