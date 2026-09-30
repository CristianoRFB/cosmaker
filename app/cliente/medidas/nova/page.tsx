'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/providers/auth-provider';
import { createMeasurementProfile } from '@/repositories/measurements.repository';

export default function NewMeasurementProfilePage() {
  const router = useRouter();
  const { user, firebaseUser } = useAuth();
  const [atelierId, setAtelierId] = useState('');
  const [name, setName] = useState('Ficha principal');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setAtelierId(new URLSearchParams(window.location.search).get('atelierId') ?? ''); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!atelierId || !user || firebaseUser?.emailVerified !== true) { setError('Confirme seu e-mail e abra este cadastro a partir de um pedido válido.'); return; }
    setPending(true);
    try {
      const profileId = await createMeasurementProfile(atelierId, user.id, { name });
      router.push(`/cliente/medidas/${encodeURIComponent(profileId)}?atelierId=${encodeURIComponent(atelierId)}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível criar a ficha.'); }
    finally { setPending(false); }
  }
  return <div className="mx-auto grid max-w-2xl gap-5">
    <Link className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700" href="/cliente/medidas"><ArrowLeft size={16} />Voltar às minhas medidas</Link>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Ruler className="text-violet-700" size={19} />Nova ficha de medidas</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-slate-600">Uma ficha pode conter qualquer conjunto de medidas. Ao confirmar um pedido, o sistema guarda uma cópia para que alterações futuras não mudem o pedido anterior.</p><form className="mt-5 grid gap-4" onSubmit={submit}><label className="grid gap-2 text-sm font-medium text-slate-800">Nome da ficha<Input maxLength={100} onChange={(event) => setName(event.target.value)} required value={name} /></label>{error ? <p className="text-sm text-rose-700" role="alert">{error}</p> : null}<Button disabled={pending || !atelierId} type="submit">{pending ? 'Salvando…' : 'Criar ficha'}</Button>{!atelierId ? <p className="text-xs text-slate-500">Para manter o isolamento dos dados, comece pela ficha aberta a partir do pedido do ateliê.</p> : null}</form></CardContent></Card>
  </div>;
}
