import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

function Brand() {
  return <Link aria-label="Cosmaker OS, início" className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-950" href="/"><span className="grid size-9 place-items-center rounded-xl bg-violet-700 text-white"><Sparkles aria-hidden="true" size={19} /></span>Cosmaker<span className="-ml-2 text-violet-700">OS</span></Link>;
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#fcfbff] text-slate-950">
    <header className="sticky top-0 z-40 border-b border-violet-100/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Brand />
        <nav aria-label="Navegação principal" className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          <Link className="transition hover:text-violet-700" href="/portfolio">Portfólio</Link>
          <Link className="transition hover:text-violet-700" href="/servicos">Serviços</Link>
          <Link className="transition hover:text-violet-700" href="/agenda">Agenda</Link>
          <Link className="transition hover:text-violet-700" href="/sobre">Sobre</Link>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-violet-50 sm:inline-flex" href="/login">Entrar</Link>
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800" href="/orcamento">Solicitar orçamento<ArrowRight aria-hidden="true" size={16} /></Link>
        </div>
      </div>
    </header>
    {children}
    <footer className="border-t border-violet-100 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto] md:items-center">
        <div><Brand /><p className="mt-3 text-sm text-slate-500">Organização para o ateliê. Mais tempo para criar.</p></div>
        <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-600"><Link href="/portfolio">Portfólio</Link><Link href="/servicos">Serviços</Link><Link href="/sobre">Sobre</Link><Link href="/login">Entrar</Link></div>
        <p className="text-xs text-slate-400 md:col-span-2">© {new Date().getFullYear()} Cosmaker OS</p>
      </div>
    </footer>
  </div>;
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fbf9ff] px-4 py-12">
    <div aria-hidden="true" className="absolute -left-40 top-0 size-96 rounded-full bg-violet-200/60 blur-3xl" />
    <div aria-hidden="true" className="absolute -right-40 bottom-0 size-96 rounded-full bg-pink-200/50 blur-3xl" />
    <div className="relative z-10 w-full max-w-md"><div className="mb-7 inline-flex"><Brand /></div>{children}<p className="mt-6 text-center text-xs text-slate-500">Feito para cosmakers e ateliês de cosplay.</p></div>
  </main>;
}
