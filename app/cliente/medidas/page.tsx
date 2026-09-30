'use client';

import Link from 'next/link';
import { ArrowRight, Ruler } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useClientMeasurementProfiles } from '@/features/measurements/use-measurements';
import { useAuth } from '@/providers/auth-provider';

export default function ClientMeasurementProfilesPage() {
  const { firebaseUser } = useAuth();
  const { profiles, loading, error } = useClientMeasurementProfiles();
  return <section className="grid gap-5">
    <Card className="flex items-center gap-4 p-5"><span className="grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Ruler size={21} /></span><div><p className="text-sm text-slate-500">Fichas ligadas aos seus ateliês</p><p className="mt-1 text-2xl font-bold text-slate-950">{loading ? '—' : profiles.length}</p></div></Card>
    {firebaseUser?.emailVerified !== true ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Confirme seu e-mail para acessar suas fichas de medidas.</div> : null}
    {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</div> : null}
    {loading ? <div className="grid gap-3">{[0, 1].map((item) => <Skeleton className="h-28 rounded-2xl" key={item} />)}</div> : null}
    {!loading && firebaseUser?.emailVerified === true && profiles.length === 0 ? <EmptyState description="Quando você aprovar uma proposta de um ateliê ou iniciar um pedido, poderá manter uma ficha reutilizável de medidas." icon={<Ruler size={21} />} title="Nenhuma ficha de medidas" /> : null}
    {!loading && profiles.length > 0 ? <div className="grid gap-3">{profiles.map((profile) => <Link className="flex items-center justify-between gap-4 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm transition hover:border-violet-200 hover:shadow-md" href={`/cliente/medidas/${encodeURIComponent(profile.id)}?atelierId=${encodeURIComponent(profile.atelierId)}`} key={`${profile.atelierId}-${profile.id}`}><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-950">{profile.name}</h2><Badge tone={profile.active ? 'green' : 'neutral'}>{profile.active ? 'Ativa' : 'Arquivada'}</Badge></div><p className="mt-1 text-xs text-slate-500">Ficha vinculada ao ateliê {profile.atelierId}</p></div><ArrowRight className="shrink-0 text-violet-700" size={18} /></Link>)}</div> : null}
  </section>;
}
