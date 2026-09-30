'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, ChevronDown, Clock3 } from 'lucide-react';
import { listPlatformAuditLogs, type PlatformAuditEntry } from '@/repositories/admin.repository';
import { formatPlatformAction, formatPlatformDate } from '@/lib/admin/format-admin';
import { AdminLoadError } from '@/components/admin/admin-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

function getError(error: unknown) { return error instanceof Error ? error.message : 'Confira a conexão e tente novamente.'; }

export default function PlatformAuditPage() {
  const [entries, setEntries] = useState<PlatformAuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (cursor: string | null = null, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const result = await listPlatformAuditLogs(cursor);
      setEntries((previous) => append ? [...previous, ...result.entries] : result.entries);
      setNextCursor(result.nextCursor);
    } catch (requestError) { setError(getError(requestError)); }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  if (loading) return <div className="grid gap-4">{[0, 1, 2, 3].map((item) => <Skeleton className="h-28 rounded-2xl" key={item} />)}</div>;
  if (error && entries.length === 0) return <AdminLoadError message={error} onRetry={() => void load()} />;

  return <div className="grid gap-5">
    <p className="max-w-3xl text-sm leading-6 text-slate-600">Eventos registrados no Firestore por operações administrativas e fluxos críticos. Cada evento preserva o responsável, entidade, horário e, quando aplicável, os dados anteriores e posteriores.</p>
    {error ? <AdminLoadError message={error} onRetry={() => void load()} /> : null}
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="text-violet-700" size={19} />Trilha de auditoria <span className="text-sm font-normal text-slate-500">({entries.length} eventos carregados)</span></CardTitle></CardHeader>
      <CardContent>
        {entries.length === 0 ? <EmptyState title="A trilha ainda está vazia" description="Quando uma ação auditável acontecer, o registro será apresentado aqui com seu responsável e horário." /> : <ol className="divide-y divide-slate-100">{entries.map((entry) => <li className="py-5 first:pt-0 last:pb-0" key={entry.id}>
          <div className="flex items-start gap-3"><span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><Clock3 size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{formatPlatformAction(entry.action)}</h2><Badge tone="violet">{entry.entity}</Badge></div><p className="mt-1 break-all font-mono text-xs text-slate-500">{entry.entityId}</p></div><time className="shrink-0 text-xs text-slate-500">{formatPlatformDate(entry.timestamp)}</time></div>
            <p className="mt-2 text-xs leading-5 text-slate-600">Responsável: <span className="font-mono">{entry.actorId || 'não informado'}</span>{entry.atelierId ? <> · Ateliê: <span className="font-mono">{entry.atelierId}</span></> : null}</p>
            {entry.before !== null || entry.after !== null ? <details className="group mt-3 rounded-xl border border-slate-200 bg-slate-50"><summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-700"><ChevronDown className="transition group-open:rotate-180" size={15} />Ver contexto da alteração</summary><div className="grid gap-3 border-t border-slate-200 p-3 md:grid-cols-2"><div><p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Antes</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-[11px] leading-5 text-slate-700">{JSON.stringify(entry.before, null, 2) ?? 'null'}</pre></div><div><p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Depois</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-[11px] leading-5 text-slate-700">{JSON.stringify(entry.after, null, 2) ?? 'null'}</pre></div></div></details> : null}
          </div></div>
        </li>)}</ol>}
        {nextCursor ? <div className="mt-5 flex justify-center"><Button disabled={loadingMore} onClick={() => void load(nextCursor, true)} variant="secondary">{loadingMore ? 'Carregando…' : 'Carregar eventos anteriores'}</Button></div> : null}
      </CardContent>
    </Card>
  </div>;
}
