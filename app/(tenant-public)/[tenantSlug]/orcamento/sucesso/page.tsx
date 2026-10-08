'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ClipboardCopy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePublicTenant } from '@/providers/public-tenant-provider';

export default function TenantQuoteRequestSuccessPage() {
  const { tenantSlug, tenant } = usePublicTenant();
  const [protocol, setProtocol] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('protocolo');
    if (value) setProtocol(value);
  }, []);

  async function copyProtocol() {
    try { await navigator.clipboard.writeText(protocol); setCopied(true); }
    catch { setCopied(false); }
  }

  return <main className="mx-auto flex min-h-[68vh] max-w-2xl items-center px-5 py-16 sm:px-8"><Card className="w-full overflow-hidden"><div className="h-1.5 bg-gradient-to-r from-violet-700 via-fuchsia-500 to-pink-400" /><CardHeader className="items-center pt-9 text-center"><span className="grid size-16 place-items-center rounded-3xl bg-emerald-100 text-emerald-700">{protocol ? <Check size={29} /> : <Sparkles size={27} />}</span><CardTitle className="mt-3 text-2xl sm:text-3xl">{protocol ? 'Solicitação registrada' : 'Confirmação indisponível'}</CardTitle></CardHeader><CardContent className="pb-8 text-center sm:px-8">
    {protocol ? <><p className="mx-auto max-w-lg text-sm leading-6 text-slate-600">{tenant?.name ?? 'O ateliê'} recebeu os detalhes do seu projeto e poderá revisar a solicitação e falar com você pelo contato informado.</p><div className="mx-auto mt-6 flex max-w-sm items-center justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3"><div className="text-left"><p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">Protocolo</p><p className="mt-1 break-all font-mono text-sm font-semibold text-slate-900">{protocol}</p></div><button aria-label="Copiar protocolo" className="rounded-lg bg-white p-2.5 text-violet-700 shadow-sm" onClick={copyProtocol} type="button">{copied ? <Check size={17} /> : <ClipboardCopy size={17} />}</button></div>{copied ? <p className="mt-2 text-xs text-emerald-700" role="status">Protocolo copiado.</p> : null}<p className="mt-5 text-xs leading-5 text-slate-500">Guarde o protocolo para referência. O Cosmaker OS não envia mensagens automáticas neste ambiente.</p></> : <p className="mx-auto max-w-lg text-sm leading-6 text-slate-600">Não encontramos um protocolo nesta página. Envie o formulário para receber a confirmação do ateliê.</p>}
    <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-200 px-4 text-sm font-semibold text-violet-800" href={`/${encodeURIComponent(tenantSlug)}`}>Voltar ao ateliê</Link>{protocol ? <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white" href="/login">Acessar minha conta<ArrowRight size={16} /></Link> : <Button onClick={() => { window.location.href = `/${encodeURIComponent(tenantSlug)}/orcamento`; }} variant="secondary">Ir para o formulário</Button>}</div>
  </CardContent></Card></main>;
}
