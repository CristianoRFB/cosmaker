import Link from 'next/link';

export default function LegacyQuoteRequestRoute() {
  return <main className="mx-auto flex min-h-[62vh] max-w-3xl items-center px-5 py-16 sm:px-8">
    <section className="w-full rounded-3xl border border-violet-100 bg-white p-7 shadow-sm sm:p-10">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">Link atualizado</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Use o endereço do seu ateliê</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">Cada formulário de orçamento pertence ao ateliê que aparece no endereço da página. Peça ao cosmaker o link público próprio para enviar sua solicitação.</p>
      <Link className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white" href="/">Voltar ao Cosmaker OS</Link>
    </section>
  </main>;
}
