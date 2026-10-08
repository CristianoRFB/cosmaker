'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Copy, ExternalLink, FlaskConical, Sparkles } from 'lucide-react';
import { PLAN_CATALOG, PRICING_TERMS } from '@/lib/commercial/catalog';
import { createPlatformDemoTenant, type PlatformDemoCreation } from '@/repositories/admin.repository';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

export default function PlanosPage() {
  const [displayName, setDisplayName] = useState('Ateliê demonstração');
  const [reason, setReason] = useState('Acesso de demonstração para apresentar o Cosmaker OS.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<PlatformDemoCreation | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingDemo, setConfirmingDemo] = useState(false);

  async function createDemo() {
    setBusy(true); setError(''); setCreated(null); setCopied(false);
    try { setCreated(await createPlatformDemoTenant(displayName, reason)); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Não foi possível criar a demonstração.'); }
    finally { setBusy(false); setConfirmingDemo(false); }
  }

  async function copyCredentials() {
    if (!created) return;
    await navigator.clipboard.writeText(`Acesso: ${created.demoEmail}\nSenha de uso único: ${created.oneTimePassword}\nÁrea pública: ${created.publicUrlPath}`);
    setCopied(true);
  }

  return <div className="grid gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-3xl text-sm leading-6 text-slate-600">Catálogo local do Cosmaker OS. A administração de planos é manual pelo Platform Owner; esta tela não processa pagamentos nem altera preços.</p><Link className="text-sm font-semibold text-violet-800 hover:underline" href="/admin/assinaturas">Ver estado dos tenants →</Link></div>
    <section aria-label="Planos aprovados" className="grid gap-4 lg:grid-cols-3">
      {PLAN_CATALOG.map((plan) => <Card className={plan.recommended ? 'relative border-violet-400 ring-2 ring-violet-100' : ''} key={plan.id}>
        {plan.recommended ? <div className="absolute right-4 top-4"><Badge tone="violet">Recomendado</Badge></div> : null}
        <CardHeader><CardDescription>Plano</CardDescription><CardTitle className="text-2xl">{plan.name}</CardTitle></CardHeader>
        <CardContent className="grid gap-4"><div><p className="text-3xl font-bold tracking-tight text-slate-950">{money(plan.monthlyPriceCents)}<span className="ml-1 text-sm font-medium text-slate-500">/ mês</span></p><p className="mt-2 text-sm text-slate-600">{money(plan.annualPriceCents)} por 12 meses, equivalente a 10 mensalidades.</p></div><div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><p className="flex items-center gap-2 font-medium"><Check aria-hidden="true" className="text-emerald-700" size={16} />Recursos centrais seguem disponíveis</p><p className="mt-2 leading-5">Diferenças por recurso e cotas numéricas aguardam aprovação. Nenhuma restrição fictícia foi cadastrada.</p></div></CardContent>
      </Card>)}
    </section>
    <div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Implantação</CardTitle><CardDescription>Metadado comercial separado dos direitos de uso.</CardDescription></CardHeader><CardContent><p className="text-2xl font-bold">{money(PRICING_TERMS.setupFeeCents)}</p><p className="mt-2 text-sm text-slate-600">Sem cobrança nesta versão.</p></CardContent></Card><Card><CardHeader><CardTitle>Trial Premium</CardTitle><CardDescription>Iniciado manualmente pelo Platform Owner no cadastro do tenant.</CardDescription></CardHeader><CardContent><p className="text-2xl font-bold">{PRICING_TERMS.trialDays} dias</p><p className="mt-2 text-sm text-slate-600">Sem cartão e sem renovação automática. A data final é gravada pelo servidor.</p></CardContent></Card></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical className="text-violet-700" size={18} />Criar espaço de demonstração</CardTitle><CardDescription>Cria um tenant isolado com branding e dados sintéticos. A senha é exibida uma única vez nesta resposta.</CardDescription></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); setConfirmingDemo(true); }}><label className="grid gap-1.5 text-sm font-medium text-slate-700">Nome para a demonstração<Input minLength={3} maxLength={100} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} /></label><label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">Motivo administrativo<Input minLength={8} maxLength={500} onChange={(event) => setReason(event.target.value)} required value={reason} /></label><Button className="sm:col-span-2 sm:w-fit" disabled={busy} type="submit">{busy ? 'Criando…' : 'Criar demonstração Premium'}</Button></form>
      {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p> : null}
      {created ? <div className="mt-5 grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:grid-cols-[1fr_auto] sm:items-start"><div><p className="flex items-center gap-2 font-semibold text-emerald-950"><Sparkles size={17} />Demonstração criada</p><dl className="mt-3 grid gap-1.5 text-sm text-emerald-950"><div><dt className="inline font-semibold">Tenant: </dt><dd className="inline font-mono">{created.atelierId}</dd></div><div><dt className="inline font-semibold">Acesso: </dt><dd className="inline">{created.demoEmail}</dd></div><div><dt className="inline font-semibold">Senha de uso único: </dt><dd className="inline break-all font-mono">{created.oneTimePassword}</dd></div><div><dt className="inline font-semibold">Página pública: </dt><dd className="inline"><Link className="underline" href={created.publicUrlPath} target="_blank">{created.publicUrlPath}<ExternalLink className="ml-1 inline" size={13} /></Link></dd></div></dl><p className="mt-3 text-xs leading-5 text-emerald-900">Guarde a senha agora. O encerramento desativa o acesso e despublica a página, sem suspender operacionalmente o ateliê ou excluir os dados.</p></div><Button onClick={() => void copyCredentials()} variant="secondary"><Copy size={15} />{copied ? 'Copiado' : 'Copiar acesso'}</Button></div> : null}
    </CardContent></Card>
    <ConfirmDialog confirmDisabled={busy} confirmLabel={busy ? 'Criando…' : 'Confirmar criação da demo'} description={`Criar ${displayName} com conta de acesso e dados fictícios. Motivo: ${reason}`} onClose={() => setConfirmingDemo(false)} onConfirm={() => void createDemo()} open={confirmingDemo} title="Criar demonstração Premium?" />
  </div>;
}
