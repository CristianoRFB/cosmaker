import Link from 'next/link';
export default function PáginaNãoEncontrada() {
  return <main className="mx-auto grid min-h-[60vh] max-w-2xl content-center gap-4 px-5 py-12"><h1 className="text-3xl font-semibold">Página não encontrada</h1><p className="text-sm leading-6 text-slate-600">Confira o link recebido. Para consultar um projeto, use o endereço público do seu ateliê ou entre na sua conta.</p><div className="flex flex-wrap gap-3"><Link className="inline-flex min-h-11 items-center rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white" href="/">Voltar ao início</Link><Link className="inline-flex min-h-11 items-center rounded-xl border border-violet-200 px-4 text-sm font-semibold text-violet-800" href="/login">Acessar minha conta</Link></div></main>;
}
