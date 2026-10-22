import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
export default function PlatformSettingsPage() {
  return <section className="grid gap-5"><div><h1 className="text-2xl font-bold text-slate-950">Controles da plataforma</h1><p className="mt-2 text-sm text-slate-600">Administre os ateliês, acompanhe indicadores e consulte a auditoria pelas operações protegidas da plataforma.</p></div><div className="grid gap-4 md:grid-cols-2">{[
    ['/admin/ateliers', 'Ateliês e estado operacional', 'Consulte o cadastro e altere suspensão ou reativação com motivo e auditoria.'],
    ['/admin/metricas', 'Indicadores globais', 'Contagens atuais de ateliês, usuários, atribuições ativas e eventos de auditoria.'],
    ['/admin/assinaturas', 'Atribuições comerciais manuais', 'Planos, trial e demonstrações pelas políticas e valores já aprovados.'],
    ['/admin/logs', 'Auditoria da plataforma', 'Histórico das alterações administrativas e críticas, com filtros e rastreabilidade.'],
  ].map(([href, title, description]) => <Card key={href}><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-slate-600">{description}</p><Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-violet-700" href={href}>Abrir controle →</Link></CardContent></Card>)}</div><Card><CardHeader><CardTitle>Operação aprovada</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-slate-600">A camada comercial mantém atribuição manual e não habilita cobrança automática. Segurança e privacidade seguem as permissões operacionais. E-mail, WhatsApp, gateway e deploy real exigem integração e autorização separadas.</p><Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-violet-700" href="/admin/planos">Consultar catálogo vigente →</Link></CardContent></Card></section>;
}
