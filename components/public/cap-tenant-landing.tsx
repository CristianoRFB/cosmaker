'use client';

import Link from 'next/link';
import { ArrowRight, Palette, PackageCheck, Scissors, ShieldCheck } from 'lucide-react';
import type { PublicTenantConfig } from '@/services/firebase/public-tenant';

export function CapTenantLanding({ tenant }: { tenant: PublicTenantConfig }) {
  const accent = tenant.brandColor || '#7f1d1d';
  return <main className="bg-[#f8f6f3] text-slate-950">
    <section className="mx-auto grid min-h-[540px] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_.85fr]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-red-900">Bonés autorais · feito sob encomenda</p>
        <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.06] tracking-[-.04em] sm:text-6xl">{tenant.name}</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-slate-700">{tenant.tagline || 'Bonés autorais com identidade própria.'}</p>
        <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600">Conte seu modelo, a cor e como quer personalizar a frente e o verso. A marca analisa os detalhes e retorna com uma proposta de orçamento.</p>
        {tenant.demoWorkspace ? <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">DEMONSTRAÇÃO — sem vendas reais, pagamento ou entrega garantida.</p> : null}
        {tenant.quoteRequestsEnabled ? <Link href={'/' + encodeURIComponent(tenant.slug) + '/orcamento'} className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-xl px-6 text-sm font-bold text-white shadow-lg" style={{backgroundColor:accent}}>Solicitar um boné personalizado<ArrowRight size={18}/></Link> :
        <p className="mt-7 rounded-xl bg-white p-4 text-sm font-semibold text-slate-700">Encomendas temporariamente fechadas.</p>}
        <p className="mt-4 text-xs text-slate-500">Solicitar orçamento não constitui compra nem reserva de produto.</p>
      </div>
      <aside className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-xl sm:p-9">
        <div className="grid size-14 place-items-center rounded-2xl bg-red-100 text-red-900"><Palette size={28}/></div>
        <h2 className="mt-6 text-2xl font-black">Uma ideia, várias possibilidades.</h2>
        <ol className="mt-6 grid gap-5">
          {[{icon:Scissors,title:'Escolha o modelo',text:'Conte a referência e a quantidade.'},{icon:Palette,title:'Descreva sua arte',text:'Indique frente, verso e cores.'},{icon:PackageCheck,title:'Acompanhe a proposta',text:'Receba análise antes de aprovar uma encomenda.'}].map(({icon:Icon,title,text},i)=>
            <li key={title} className="flex items-start gap-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-800"><Icon size={19}/></span><div><p className="font-bold">{String(i+1).padStart(2,'0')} · {title}</p><p className="mt-1 text-sm text-slate-600">{text}</p></div></li>)}
        </ol>
        <p className="mt-7 flex items-start gap-2 border-t border-stone-200 pt-5 text-xs text-slate-600"><ShieldCheck size={17} className="shrink-0"/>Sem checkout ou cobrança automática nesta etapa.</p>
      </aside>
    </section>
  </main>;
}
