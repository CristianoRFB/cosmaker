'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Ruler } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useMeasurementProfile } from '@/features/measurements/use-measurements';
import { addMeasurement, updateMeasurement } from '@/repositories/measurements.repository';
import type { Measurement } from '@/types/measurement';

function MeasurementEditor({ atelierId, profileId, measurement, onSaved }: { atelierId: string; profileId: string; measurement: Measurement; onSaved: () => void }) {
  const [value, setValue] = useState(String(measurement.value));
  const [unit, setUnit] = useState(measurement.unit);
  const [notes, setNotes] = useState(measurement.notes ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError('');
    try { await updateMeasurement(atelierId, profileId, { ...measurement, value: Number(value), unit, notes }); onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a medida.'); }
    finally { setPending(false); }
  }
  return <form className="grid gap-3 rounded-xl border border-slate-100 p-4" onSubmit={save}>
    <div><p className="font-semibold text-slate-900">{measurement.label}</p><p className="text-xs capitalize text-slate-500">{measurement.type}</p></div>
    <div className="grid grid-cols-[1fr_7rem] gap-3"><label className="grid gap-1 text-xs text-slate-600">Valor<Input inputMode="decimal" onChange={(event) => setValue(event.target.value)} required type="number" value={value} /></label><label className="grid gap-1 text-xs text-slate-600">Unidade<Input maxLength={20} onChange={(event) => setUnit(event.target.value)} required value={unit} /></label></div>
    <label className="grid gap-1 text-xs text-slate-600">Observação<Textarea className="min-h-16" maxLength={500} onChange={(event) => setNotes(event.target.value)} value={notes} /></label>
    {error ? <p className="text-xs text-rose-700" role="alert">{error}</p> : null}<Button disabled={pending} type="submit" variant="secondary">{pending ? 'Salvando…' : 'Atualizar medida'}</Button>
  </form>;
}

export default function ClientMeasurementProfilePage() {
  const params = useParams<{ profileId: string }>();
  const [atelierId, setAtelierId] = useState('');
  const [type, setType] = useState('circumference');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('cm');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { profile, measurements, loading, error: loadError, reload } = useMeasurementProfile(atelierId, params.profileId);
  useEffect(() => { setAtelierId(new URLSearchParams(window.location.search).get('atelierId') ?? ''); }, []);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError('');
    try {
      await addMeasurement(atelierId, params.profileId, { type, label, value: Number(value), unit, notes });
      setLabel(''); setValue(''); setNotes(''); await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível adicionar a medida.'); }
    finally { setPending(false); }
  }

  if (loading) return <div className="grid gap-4"><Skeleton className="h-12 rounded-2xl" /><Skeleton className="h-56 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>;
  if (loadError || !profile) return <div className="grid gap-4"><p className="text-sm text-rose-700" role="alert">{loadError || 'A ficha não existe ou não está vinculada à sua conta.'}</p><Link className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700" href="/cliente/medidas"><ArrowLeft size={16} />Voltar às minhas medidas</Link></div>;

  return <div className="mx-auto grid max-w-3xl gap-5">
    <Link className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700" href="/cliente/medidas"><ArrowLeft size={16} />Voltar às minhas medidas</Link>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Ruler className="text-violet-700" size={19} />{profile.name}</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-slate-600">Adicione as medidas necessárias para este projeto. O tipo é livre, então a ficha acompanha o que cada personagem e peça exige.</p><p className="mt-2 text-xs text-slate-500">Ateliê {atelierId} · alterações desta ficha não modificam snapshots de pedidos confirmados.</p></CardContent></Card>
    <Card><CardHeader><CardTitle>Medidas cadastradas ({measurements.length})</CardTitle></CardHeader><CardContent>{measurements.length ? <div className="grid gap-3">{measurements.map((measurement) => <MeasurementEditor atelierId={atelierId} key={measurement.id} measurement={measurement} onSaved={() => void reload()} profileId={profile.id} />)}</div> : <EmptyState description="Use o formulário abaixo para registrar a primeira medida desta ficha." title="Ficha sem medidas" />}</CardContent></Card>
    <Card><CardHeader><CardTitle>Adicionar medida</CardTitle></CardHeader><CardContent><form className="grid gap-4" onSubmit={add}><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium text-slate-800">Tipo<Input maxLength={80} onChange={(event) => setType(event.target.value)} required value={type} /></label><label className="grid gap-2 text-sm font-medium text-slate-800">Nome da medida<Input maxLength={100} onChange={(event) => setLabel(event.target.value)} placeholder="Ex.: Tórax" required value={label} /></label></div><div className="grid gap-4 sm:grid-cols-[1fr_10rem]"><label className="grid gap-2 text-sm font-medium text-slate-800">Valor<Input inputMode="decimal" onChange={(event) => setValue(event.target.value)} required type="number" value={value} /></label><label className="grid gap-2 text-sm font-medium text-slate-800">Unidade<Input maxLength={20} onChange={(event) => setUnit(event.target.value)} required value={unit} /></label></div><label className="grid gap-2 text-sm font-medium text-slate-800">Observação opcional<Textarea maxLength={500} onChange={(event) => setNotes(event.target.value)} value={notes} /></label>{error ? <p className="text-sm text-rose-700" role="alert">{error}</p> : null}<Button disabled={pending} type="submit">{pending ? 'Salvando…' : 'Adicionar medida'}</Button></form></CardContent></Card>
  </div>;
}
