'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { resolvePublicTenant } from '@/services/firebase/public-tenant';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/** Legacy global links require explicit atelier context; there is no default tenant. */
export function TenantEntry({ title, description, destination = 'home' }: { title: string; description: string; destination?: 'home' | 'servicos' | 'portfolio' | 'orcamento' }) {
  const router = useRouter(); const [slug, setSlug] = useState(''); const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const [available, setAvailable] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setAvailable('');
    const candidate = slug.trim().toLowerCase();
    if (candidate.length > 63 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate)) { setError('Informe o identificador do endereço recebido do seu ateliê.'); return; }
    setPending(true);
    try {
      const result = await resolvePublicTenant(candidate);
      if (result.status !== 'available' || result.tenant?.slug !== candidate || !result.tenant.published) {
        setError(result.status === 'error' || result.status === 'not_configured' ? 'Não foi possível consultar o endereço agora. Tente novamente.' : 'Este endereço não está disponível. Confira o link recebido do ateliê.'); return;
      }
      if (destination === 'orcamento' && !result.tenant.quoteRequestsEnabled) { setAvailable(candidate); setError('Este ateliê está com novas solicitações temporariamente fechadas.'); return; }
      const suffix = destination === 'orcamento' ? '/orcamento' : destination === 'home' ? '' : `#${destination}`;
      router.push(`/${encodeURIComponent(candidate)}${suffix}`);
    } finally { setPending(false); }
  }
  return <main className="mx-auto grid min-h-[62vh] max-w-3xl content-center gap-5 px-4 py-12 sm:px-8">
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm sm:p-8"><h1 className="text-3xl font-bold tracking-tight text-slate-950">{title}</h1><p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>
      <form className="mt-6 grid gap-4" onSubmit={submit}><label htmlFor="public-atelier-slug" className="grid gap-2 text-sm font-medium text-slate-800">Endereço do ateliê<Input id="public-atelier-slug" name="tenantSlug" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={63} required placeholder="identificador-do-atelie" value={slug} onChange={event => setSlug(event.target.value)} disabled={pending} aria-describedby="atelier-address-help" /></label><p id="atelier-address-help" className="text-sm text-slate-500">Use o identificador que aparece depois da barra no link público enviado pelo cosmaker.</p>
        {error ? <p role="alert" className="text-sm text-rose-800">{error}</p> : null}<Button type="submit" disabled={pending}>{pending ? 'Consultando endereço…' : 'Abrir ateliê'}</Button>
      </form>
      {available ? <Link className="mt-4 inline-flex min-h-11 items-center font-semibold text-violet-700 underline" href={`/${encodeURIComponent(available)}`}>Ver página pública do ateliê</Link> : null}
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2"><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-violet-700 underline" href="/">Conhecer o Cosmaker OS</Link><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-violet-700 underline" href="/cliente/mensagens">Já sou cliente</Link></div>
    </section>
  </main>;
}
