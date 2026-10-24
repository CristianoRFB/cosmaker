'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { useTenant } from '@/providers/tenant-provider';
import { getAtelierClient } from '@/repositories/clients.repository';
import { createMeasurementProfile, listAtelierClientMeasurementProfiles, updateMeasurementProfile } from '@/repositories/measurements.repository';
import { MeasurementProfileEditor } from '@/components/medidas/measurement-profile-editor';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import type { MeasurementProfile } from '@/types/measurement';

export default function MedidasDoCliente() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const { atelierId, membershipValid, hasPermission } = useTenant();
  const canRead = hasPermission('measurements:read') || hasPermission('measurements:write');
  const canWrite = hasPermission('measurements:write');
  const [profiles, setProfiles] = useState<MeasurementProfile[]>([]);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('Ficha principal');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const toast = useToast();
  const backHref = `/atelier/clientes/${encodeURIComponent(clienteId)}`;
  const load = useCallback(async () => {
    if (!atelierId || !membershipValid || !canRead) { setProfiles([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      await getAtelierClient(clienteId);
      const result = await listAtelierClientMeasurementProfiles(atelierId, clienteId);
      setProfiles(result); setSelected(current => result.some(profile => profile.id === current) ? current : result[0]?.id || '');
    } catch (reason) { setProfiles([]); setSelected(''); setError(reason instanceof Error ? reason.message : 'Não foi possível consultar as medidas.'); }
    finally { setLoading(false); }
  }, [atelierId, membershipValid, canRead, clienteId]);
  useEffect(() => { void load(); }, [load]);
  async function create(event: FormEvent) {
    event.preventDefault(); if (!atelierId || !canWrite) return;
    setPending(true); setError('');
    try { const id = await createMeasurementProfile(atelierId, clienteId, { name }); await load(); setSelected(id); toast('Ficha criada.', 'success'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível criar a ficha.'); }
    finally { setPending(false); }
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!atelierId || !canWrite || !selected) return;
    const values = new FormData(event.currentTarget);
    setPending(true); setError('');
    try { await updateMeasurementProfile(atelierId, selected, { name: String(values.get('name') || ''), active: values.get('active') === 'on' }); await load(); setRevision(value => value + 1); toast('Ficha atualizada.', 'success'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a ficha.'); }
    finally { setPending(false); }
  }
  if (!canRead) return <p role="alert">Seu perfil não tem permissão para consultar medidas.</p>;
  const profile = profiles.find(item => item.id === selected);
  return <section className="grid gap-5"><Link className="inline-flex min-h-11 items-center font-semibold text-violet-700 underline" href={backHref}>Voltar ao cliente</Link><h1 className="text-2xl font-semibold">Medidas do cliente</h1>
    {loading ? <p role="status">Carregando fichas…</p> : null}
    {error ? <p className="text-sm text-rose-800" role="alert">{error}</p> : null}
    {!loading && !error && !profiles.length ? <Card className="p-5">Nenhuma ficha cadastrada para este cliente.</Card> : null}
    {!error && canWrite ? <Card className="p-5"><form className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={create}><label className="grid min-w-0 gap-2 text-sm font-medium">Nome da nova ficha<Input required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label><Button type="submit" disabled={pending || loading}>Criar ficha</Button></form></Card> : null}
    {profiles.length ? <label className="grid min-w-0 gap-2 text-sm font-medium">Ficha<select className="min-h-11 w-full min-w-0 rounded-xl border p-3" value={selected} onChange={event => setSelected(event.target.value)}>{profiles.map(item => <option key={item.id} value={item.id}>{item.name}{item.active ? '' : ' · Arquivada'}</option>)}</select></label> : null}
    {profile && canWrite ? <Card className="p-5"><form key={`${profile.id}/${revision}`} className="grid gap-3" onSubmit={saveProfile}><label className="grid gap-2 text-sm font-medium">Nome da ficha<Input name="name" maxLength={100} required defaultValue={profile.name} /></label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={profile.active} />Ficha ativa para novos pedidos</label><Button variant="secondary" type="submit" disabled={pending}>Salvar ficha</Button></form></Card> : null}
    {atelierId && selected ? <MeasurementProfileEditor key={`${atelierId}/${selected}/${revision}`} atelierId={atelierId} profileId={selected} backHref={backHref} readOnly={!canWrite} /> : null}
  </section>;
}
