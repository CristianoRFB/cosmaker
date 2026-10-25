'use client';
import { useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/services/firebase/firebase.client';
import { sparkProofCall } from '@/services/spark/transport';
export function SparkProof() {
  const [message, setMessage] = useState('Entre com uma conta fictícia do emulador.');
  const [busy, setBusy] = useState(false);
  const [tenant, setTenant] = useState('');
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const email = String(form.get('email'));
      if (!email.endsWith('@cosmaker.test') || !auth) throw new Error('Use uma conta sintética local.');
      const user = await signInWithEmailAndPassword(auth, email, String(form.get('password')));
      const workspace = await sparkProofCall<{ atelierId: string; role: string }>('getTenantWorkspace', await user.user.getIdToken(), {});
      setTenant(workspace.atelierId); setMessage(`Conectado ao ateliê ${workspace.atelierId}, papel ${workspace.role}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha no teste local.'); }
    finally { setBusy(false); }
  }
  async function record() {
    setBusy(true);
    try {
      if (!auth?.currentUser) throw new Error('Entre primeiro.');
      const result = await sparkProofCall<{ entryId: string }>('recordFinanceEntry', await auth.currentUser.getIdToken(), {
        requestId: crypto.randomUUID(), kind: 'expense', basis: 'actual', category: 'materials', amountCents: 1234,
        description: 'Despesa sintética de viabilidade', effectiveDate: new Date().toISOString().slice(0, 10),
      });
      setMessage(`Lançamento persistido: ${result.entryId}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha na persistência.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-lg space-y-5 p-4">
    <h1 className="text-2xl font-semibold">Prova local Spark</h1>
    <p>Infraestrutura experimental. Arquitetura anterior preservada. Sem equivalência ou produção homologadas.</p>
    <form onSubmit={login} className="space-y-4">
      <label className="block">E-mail fictício<input className="mt-1 block min-h-11 w-full rounded border p-2" required type="email" name="email" autoComplete="username" /></label>
      <label className="block">Senha fictícia<input className="mt-1 block min-h-11 w-full rounded border p-2" required type="password" name="password" autoComplete="current-password" /></label>
      <button className="min-h-11 rounded border px-4" disabled={busy} type="submit">Conectar ao Worker</button>
    </form>
    <button className="min-h-11 rounded border px-4" type="button" disabled={busy || !tenant} onClick={record}>Registrar despesa sintética de R$12,34</button>
    <p role="status" aria-live="polite" className="break-all">{busy ? 'Processando…' : message}</p>
  </main>;
}
