'use client';

import Link from 'next/link';
import { ArrowRight, Scissors, Sparkles } from 'lucide-react';
import { usePublicTenant } from '@/providers/public-tenant-provider';

function TenantMessage({ title, detail }: { title: string; detail: string }) {
  return <main className="mx-auto flex min-h-[58vh] max-w-3xl items-center px-5 py-16 sm:px-8"><section className="w-full rounded-3xl border border-violet-100 bg-white p-7 shadow-sm sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">Página do ateliê</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{title}</h1><p className="mt-4 text-sm leading-6 text-slate-600">{detail}</p></section></main>;
}

export default function TenantLandingPage() {
  const { tenant, status, loading } = usePublicTenant();
  if (loading) return <TenantMessage detail="Estamos carregando a configuração pública." title="Carregando ateliê…" />;
  if (status === 'suspended') return <TenantMessage detail="O ateliê está temporariamente suspenso e não pode receber novas solicitações." title="Ateliê temporariamente indisponível" />;
  if (status === 'not_found' || status === 'invalid_slug') return <TenantMessage detail="Confira o endereço que você recebeu ou peça o link correto ao ateliê." title="Ateliê não encontrado" />;
  if (status === 'not_configured') return <TenantMessage detail="O ambiente ainda não está conectado ao Firebase." title="Página indisponível" />;
  if (status === 'error') return <TenantMessage detail="Não foi possível carregar esta página agora. Tente novamente em instantes." title="Falha ao carregar o ateliê" />;
  if (!tenant?.published) return <TenantMessage detail={tenant?.quoteRequestsEnabled ? 'Esta página ainda não foi publicada. Se recebeu o link do formulário, use-o para continuar.' : 'Esta página ainda não foi publicada pelo ateliê.'} title="Página ainda não publicada" />;

  const brandColor = tenant.brandColor;
  return <main>
    <section className="relative isolate overflow-hidden bg-[linear-gradient(120deg,#fbf9ff_0%,#f7f1ff_47%,#fff2f7_100%)]">
      <div aria-hidden="true" className="absolute -left-48 top-0 -z-10 size-[36rem] rounded-full bg-violet-200/50 blur-3xl" />
      <div aria-hidden="true" className="absolute -right-48 bottom-0 -z-10 size-[34rem] rounded-full bg-pink-200/60 blur-3xl" />
      <div className="mx-auto grid min-h-[520px] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.02fr_.98fr] md:py-20">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/75 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-800"><Sparkles aria-hidden="true" size={14} />Ateliê independente</p>
          <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">{tenant.name ?? 'Cosplay feito para você'}<span className="block bg-gradient-to-r from-violet-700 via-fuchsia-600 to-pink-500 bg-clip-text text-transparent">do primeiro contato à entrega.</span></h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">{tenant.tagline ?? 'Compartilhe sua ideia, referências e prazo. O ateliê acompanha cada detalhe do projeto com você.'}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {tenant.quoteRequestsEnabled ? <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-300/40 transition hover:-translate-y-0.5 hover:bg-violet-800" href={`/${encodeURIComponent(tenant.slug)}/orcamento`} style={brandColor ? { backgroundColor: brandColor } : undefined}>Solicitar um orçamento<ArrowRight size={17} /></Link> : <span className="inline-flex min-h-12 items-center rounded-xl bg-white/80 px-5 text-sm font-semibold text-slate-600">Solicitações temporariamente fechadas</span>}
          </div>
          <div className="mt-8 inline-flex items-center gap-2 text-sm text-slate-600"><Scissors className="text-violet-700" size={17} />Projetos acompanhados pelo próprio ateliê</div>
        </div>
        <div className="relative mx-auto w-full max-w-[540px]">
          <div aria-hidden="true" className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-violet-300/50 via-white/20 to-pink-300/50 blur-2xl" />
          <div className="relative overflow-hidden rounded-[1.8rem] border border-white bg-white/90 p-6 shadow-[0_36px_100px_-46px_rgba(71,42,130,.55)] backdrop-blur sm:p-8">
            <span className="grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-700" style={brandColor ? { backgroundColor: `${brandColor}22`, color: brandColor } : undefined}><Sparkles size={22} /></span>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-violet-700">Um projeto feito em conjunto</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Sua ideia ganha forma com atenção aos detalhes.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">Conte sobre o personagem, o uso e a data que você tem em mente. O ateliê revisará cada informação antes de preparar uma proposta.</p>
            <ol className="mt-7 grid gap-4">{['Compartilhe sua ideia e referências', 'Alinhe detalhes com o ateliê', 'Acompanhe a proposta e a produção'].map((step, index) => <li className="flex items-center gap-3" key={step}><span className="grid size-8 shrink-0 place-items-center rounded-xl bg-violet-100 text-xs font-bold text-violet-800" style={brandColor ? { backgroundColor: `${brandColor}22`, color: brandColor } : undefined}>0{index + 1}</span><span className="text-sm font-medium text-slate-700">{step}</span></li>)}</ol>
          </div>
        </div>
      </div>
    </section>
  </main>;
}
