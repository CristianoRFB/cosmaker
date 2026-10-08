import Link from 'next/link';
import { ArrowDown, ArrowRight, CalendarDays, Check, ClipboardList, Package, Ruler, Scissors, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';

const features = [
  { title: 'Solicitações e orçamentos', description: 'Reúna os detalhes do projeto e mantenha cada conversa ligada ao pedido.', icon: ClipboardList, tone: 'violet' },
  { title: 'Produção organizada', description: 'Acompanhe etapas, prazos e aprovações em uma visão clara do trabalho.', icon: Scissors, tone: 'pink' },
  { title: 'Agenda por capacidade', description: 'Planeje encomendas de acordo com as horas disponíveis no ateliê.', icon: CalendarDays, tone: 'blue' },
  { title: 'Medidas e referências', description: 'Guarde informações importantes junto ao cliente e ao projeto certo.', icon: Ruler, tone: 'amber' },
  { title: 'Pagamentos e entregas', description: 'Visualize valores e etapas financeiras sem perder o histórico do pedido.', icon: WalletCards, tone: 'green' },
  { title: 'Clientes em um só lugar', description: 'Pedidos, mensagens e atualizações ficam organizados por cliente.', icon: Package, tone: 'violet' },
];

export default function CosmakerOs() {
  return <main>
    <section className="relative isolate overflow-hidden bg-[linear-gradient(120deg,#fbf9ff_0%,#f7f1ff_47%,#fff2f7_100%)]">
      <div aria-hidden="true" className="absolute -left-48 top-0 -z-10 size-[36rem] rounded-full bg-violet-200/50 blur-3xl" />
      <div aria-hidden="true" className="absolute -right-48 bottom-0 -z-10 size-[34rem] rounded-full bg-pink-200/60 blur-3xl" />
      <div className="mx-auto grid min-h-[590px] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.02fr_.98fr] md:py-20">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/75 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-800"><Sparkles aria-hidden="true" size={14} />Mais organização para criar</p>
          <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">Seu ateliê de cosplay, <span className="bg-gradient-to-r from-violet-700 via-fuchsia-600 to-pink-500 bg-clip-text text-transparent">do primeiro contato à entrega.</span></h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">Organize solicitações, orçamentos, medidas e etapas de produção em um só lugar. Menos tempo procurando informação; mais tempo fazendo o que você ama.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-300/40 transition hover:-translate-y-0.5 hover:bg-violet-800" href="#recursos">Conhecer o sistema<ArrowRight size={17} /></Link>
            <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white/80 px-5 text-sm font-semibold text-violet-900 transition hover:bg-white" href="/login">Acessar minha conta</Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600"><span className="inline-flex items-center gap-2"><Check className="text-emerald-600" size={16} />Feito para ateliês independentes</span><span className="inline-flex items-center gap-2"><ShieldCheck className="text-violet-600" size={16} />Informações organizadas por ateliê</span></div>
        </div>

        <div className="relative mx-auto w-full max-w-[600px]">
          <div aria-hidden="true" className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-violet-300/50 via-white/20 to-pink-300/50 blur-2xl" />
          <div className="relative overflow-hidden rounded-[1.8rem] border border-white bg-white/90 p-4 shadow-[0_36px_100px_-46px_rgba(71,42,130,.55)] backdrop-blur sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4"><div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-violet-100 text-violet-700"><Sparkles size={18} /></span><div><p className="text-sm font-bold">Cosmaker OS</p><p className="text-xs text-slate-500">Fluxo do ateliê</p></div></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Da ideia à entrega</span></div>
            <div className="mt-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Uma encomenda</p><p className="mt-1 text-xl font-bold tracking-tight">Da ideia ao cosplay</p></div><span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 text-violet-700"><Scissors size={20} /></span></div>
            <div className="relative mt-6 grid gap-3">
              <div className="absolute bottom-8 left-[22px] top-8 w-px bg-gradient-to-b from-violet-300 via-fuchsia-300 to-emerald-300" />
              {[{ icon: ClipboardList, step: '01', title: 'Solicitação recebida', detail: 'Personagem, referências e prazo' }, { icon: WalletCards, step: '02', title: 'Orçamento acompanhado', detail: 'Itens, valores e aprovação' }, { icon: Scissors, step: '03', title: 'Produção em andamento', detail: 'Etapas, fotos e ajustes' }, { icon: Package, step: '04', title: 'Entrega organizada', detail: 'Pagamento final e envio' }].map(({ icon: Icon, step, title, detail }, index) => <div className="relative flex items-center gap-4 rounded-2xl border border-slate-100 bg-white px-3.5 py-3.5 sm:px-4" key={step}><span className={`relative z-10 grid size-10 shrink-0 place-items-center rounded-xl ${index === 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}><Icon size={18} /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{title}</p><p className="mt-0.5 text-xs text-slate-500">{detail}</p></div><span className="text-xs font-bold tracking-wider text-slate-300">{step}</span></div>)}
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-gradient-to-r from-violet-50 to-pink-50 p-4"><Sparkles className="mt-0.5 shrink-0 text-fuchsia-600" size={17} /><p className="text-sm leading-6 text-slate-700">Cada projeto tem seu histórico. Assim, cliente e equipe sabem o que vem a seguir.</p></div>
          </div>
          <span aria-hidden="true" className="absolute -right-4 -top-5 grid size-12 place-items-center rounded-2xl border border-white bg-white text-pink-500 shadow-lg"><Sparkles size={21} /></span>
        </div>
      </div>
      <a aria-label="Ver recursos" className="mx-auto mb-5 hidden w-fit items-center gap-2 text-xs font-semibold text-slate-500 md:flex" href="#recursos">Conheça os recursos<ArrowDown size={14} /></a>
    </section>

    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8" id="recursos">
      <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Um espaço para cada etapa</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">O trabalho criativo merece uma rotina mais leve.</h2><p className="mt-4 text-base leading-7 text-slate-600">Acompanhe o ciclo do projeto com informações claras para quem cria e para quem está esperando o próximo cosplay.</p></div>
      <div className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map(({ title, description, icon: Icon, tone }) => <article className="group rounded-2xl border border-violet-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg" key={title}><span className={`grid size-12 place-items-center rounded-2xl ${tone === 'pink' ? 'bg-pink-100 text-pink-700' : tone === 'blue' ? 'bg-sky-100 text-sky-700' : tone === 'amber' ? 'bg-amber-100 text-amber-700' : tone === 'green' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}><Icon size={21} /></span><h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></article>)}</div>
    </section>

    <section className="border-y border-violet-100 bg-white py-20"><div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 md:grid-cols-[.8fr_1.2fr] md:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">Criar com tranquilidade</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Um caminho claro para cada encomenda.</h2><p className="mt-4 max-w-md text-base leading-7 text-slate-600">Da primeira conversa ao pacote pronto, as informações acompanham o projeto.</p><Link className="mt-6 inline-flex items-center gap-2 font-semibold text-violet-700" href="#recursos">Ver recursos<ArrowRight size={16} /></Link></div><div className="grid gap-3 sm:grid-cols-3">{[{ title: 'Compartilhe a ideia', detail: 'Conte sobre o personagem e as referências.' }, { title: 'Alinhe o projeto', detail: 'Receba uma proposta e combine os detalhes.' }, { title: 'Acompanhe a criação', detail: 'Veja as atualizações até a entrega.' }].map((step, index) => <div className="rounded-2xl bg-[#faf8ff] p-5" key={step.title}><span className="grid size-9 place-items-center rounded-xl bg-violet-700 text-sm font-bold text-white">0{index + 1}</span><h3 className="mt-5 font-semibold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p></div>)}</div></div></section>

    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8"><div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-800 via-violet-700 to-fuchsia-700 px-6 py-12 text-white sm:px-12 sm:py-14"><div aria-hidden="true" className="absolute -right-20 -top-32 size-80 rounded-full border-[45px] border-white/10" /><div className="relative z-10 max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">Mais organização para criar</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Seu ateliê, da solicitação à entrega.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-violet-100 sm:text-base">Cada Cosmaker compartilha um endereço próprio para receber projetos e acompanhar sua produção.</p><Link className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-violet-800 transition hover:bg-violet-50" href="/login">Acessar o sistema<ArrowRight size={17} /></Link></div></div></section>
  </main>;
}
