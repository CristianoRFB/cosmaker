import Link from 'next/link';
import { TestOnlyCommercialProbe } from '@/components/commercial/test-only-commercial-probe';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight, Box, ClipboardList, UsersRound } from 'lucide-react';

const overview = [
  { title: 'Solicitações', description: 'Acompanhe novos pedidos de orçamento.', href: '/atelier/solicitacoes', icon: ClipboardList },
  { title: 'Clientes', description: 'Consulte os cadastros e medidas.', href: '/atelier/clientes', icon: UsersRound },
  { title: 'Pedidos', description: 'Veja a fila de produção e o histórico.', href: '/atelier/pedidos', icon: Box },
];

export default function DashboardDoAteliê() {
  return <div className="grid gap-5">
    <section className="grid gap-4 md:grid-cols-3" aria-label="Acessos do ateliê">
      {overview.map(({ title, description, href, icon: Icon }) => <Link className="group rounded-2xl border border-violet-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md" href={href} key={title}>
        <span className="grid size-10 place-items-center rounded-xl bg-violet-100 text-violet-800"><Icon aria-hidden="true" size={19} /></span><p className="mt-4 flex items-center justify-between font-semibold text-slate-950">{title}<ArrowUpRight aria-hidden="true" className="text-slate-400 group-hover:text-violet-700" size={16} /></p><p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
      </Link>)}
    </section>
    <Card><CardHeader><CardTitle>Seu espaço de trabalho</CardTitle><CardDescription>As funções do Cosmaker OS continuam disponíveis conforme as permissões do seu perfil.</CardDescription></CardHeader><CardContent className="text-sm leading-6 text-slate-600">Planos não alteram acesso operacional enquanto nenhuma diferença comercial específica tiver sido aprovada e configurada.</CardContent></Card>
    <TestOnlyCommercialProbe />
  </div>;
}
