import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { navigationFor } from '@/lib/navigation/workspace';

export default function DashboardDoCliente() {
  return <section aria-labelledby="client-start-title" className="grid gap-4">
    <div><h2 className="text-lg font-semibold text-slate-900" id="client-start-title">O que você precisa fazer?</h2><p className="mt-1 text-sm leading-6 text-slate-600">Escolha uma área para continuar. Para uma proposta, abra Orçamentos; para um projeto confirmado, abra Meus pedidos.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{navigationFor('client').filter((item) => item.href !== '/cliente').map(({ href, label, description }) => <Link className="group rounded-2xl border border-violet-100 bg-white p-5 transition hover:border-violet-300 hover:shadow-sm" href={href} key={href}><span className="flex items-center justify-between gap-3 font-semibold text-slate-900">{label}<ArrowRight aria-hidden="true" className="shrink-0 text-violet-700" size={18} /></span><span className="mt-2 block text-sm leading-6 text-slate-600">{description}</span></Link>)}</div>
  </section>;
}
