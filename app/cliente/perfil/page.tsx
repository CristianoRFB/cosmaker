'use client';

import { useState, type FormEvent } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/providers/auth-provider';
import { requireFirebase } from '@/services/firebase/firebase.client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import type { User } from '@/types/user';

function ProfileForm({ user }: { user: User }) {
  const { firebaseUser, refreshUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSaved(false);
    if (!name.trim() || name.trim().length > 100 || phone.trim().length > 32) { setError('Confira o nome e o telefone informados.'); return; }
    const { db, auth } = requireFirebase();
    if (!auth.currentUser || auth.currentUser.uid !== user.id || user.accountType !== 'client' || !user.active) { setError('Sua sessão não permite alterar este perfil. Entre novamente.'); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { name: name.trim(), phone: phone.trim(), updatedAt: serverTimestamp() });
      setSaved(true); toast('Perfil salvo.', 'success'); await refreshUser();
    } catch { setError('Não foi possível salvar seu perfil. Verifique sua conexão e tente novamente.'); }
    finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="grid max-w-2xl gap-5">
    <Card className="grid gap-5 p-5 sm:p-6">
      <div><h2 className="text-lg font-semibold">Informações pessoais</h2><p className="mt-1 text-sm text-slate-600">Seu nome e telefone de contato na conta Cosmaker.</p></div>
      <label className="grid gap-2 text-sm font-medium" htmlFor="profile-name">Nome<Input id="profile-name" autoComplete="name" required maxLength={100} value={name} onChange={event => { setName(event.target.value); setSaved(false); }} disabled={saving} /></label>
      <label className="grid gap-2 text-sm font-medium" htmlFor="profile-phone">Telefone<Input id="profile-phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={32} value={phone} onChange={event => { setPhone(event.target.value); setSaved(false); }} disabled={saving} /></label>
      <label className="grid gap-2 text-sm font-medium" htmlFor="profile-email">E-mail da conta<Input id="profile-email" type="email" value={firebaseUser?.email || user.email} readOnly aria-describedby="email-policy" /></label>
      <p id="email-policy" className="text-sm text-slate-600">{firebaseUser?.emailVerified ? 'E-mail verificado.' : 'E-mail ainda não verificado.'} Alterações de nome e telefone preservam os cadastros e históricos mantidos pelos ateliês.</p>
      {error ? <p role="alert" className="text-sm text-rose-800">{error}</p> : null}
      {saved ? <p role="status" className="text-sm text-emerald-800">Perfil salvo.</p> : null}
      <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar perfil'}</Button>
    </Card>
  </form>;
}

export default function MeuPerfil() {
  const { user, firebaseUser, loading } = useAuth();
  if (loading) return <p role="status">Carregando perfil…</p>;
  if (!user || user.id !== firebaseUser?.uid || !user.active || user.accountType !== 'client') return <p role="alert">Sua conta não tem acesso a este perfil.</p>;
  return <section className="grid gap-5"><h1 className="text-2xl font-semibold">Meu perfil</h1><ProfileForm key={user.id} user={user} /></section>;
}
