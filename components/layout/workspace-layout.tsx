'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Bell, CalendarDays, ChartNoAxesCombined, CircleUserRound, ClipboardList, CreditCard, FileText, Home, Layers3, LogOut, MessageCircle, Package, Ruler, Scissors, Settings, Sparkles, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { AuthGuard, type Audience } from './auth-guard';
import { useAuth } from '@/providers/auth-provider';

const clientNavigation = [
  { href: '/cliente', label: 'Início', icon: Home },
  { href: '/cliente/pedidos', label: 'Meus pedidos', icon: Package },
  { href: '/cliente/orcamentos', label: 'Orçamentos', icon: FileText },
  { href: '/cliente/medidas', label: 'Minhas medidas', icon: Ruler },
  { href: '/cliente/pagamentos', label: 'Pagamentos', icon: CreditCard },
  { href: '/cliente/mensagens', label: 'Mensagens', icon: MessageCircle },
  { href: '/cliente/notificacoes', label: 'Notificações', icon: Bell },
  { href: '/cliente/perfil', label: 'Meu perfil', icon: CircleUserRound },
];
const atelierNavigation = [
  { href: '/atelier', label: 'Visão geral', icon: Home },
  { href: '/atelier/solicitacoes', label: 'Solicitações', icon: ClipboardList },
  { href: '/atelier/orcamentos', label: 'Orçamentos', icon: FileText },
  { href: '/atelier/pedidos', label: 'Pedidos', icon: Package },
  { href: '/atelier/producao', label: 'Produção', icon: Scissors },
  { href: '/atelier/agenda', label: 'Agenda e capacidade', icon: CalendarDays },
  { href: '/atelier/clientes', label: 'Clientes', icon: Users },
  { href: '/atelier/financeiro', label: 'Financeiro', icon: CreditCard },
  { href: '/atelier/estoque', label: 'Estoque', icon: Layers3 },
  { href: '/atelier/relatorios', label: 'Relatórios', icon: ChartNoAxesCombined },
  { href: '/atelier/configuracoes', label: 'Configurações', icon: Settings },
];
const adminNavigation = [
  { href: '/admin', label: 'Visão geral', icon: Home },
  { href: '/admin/ateliers', label: 'Ateliês', icon: Scissors },
  { href: '/admin/usuarios', label: 'Usuários', icon: Users },
  { href: '/admin/planos', label: 'Planos', icon: Layers3 },
  { href: '/admin/assinaturas', label: 'Assinaturas', icon: CreditCard },
  { href: '/admin/metricas', label: 'Métricas', icon: ChartNoAxesCombined },
  { href: '/admin/logs', label: 'Auditoria', icon: FileText },
  { href: '/admin/configuracoes', label: 'Configurações', icon: Settings },
];

export function WorkspaceLayout({ audience, title, children }: { audience: Audience; title: string; children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const navigation = audience === 'client' ? clientNavigation : audience === 'atelier' ? atelierNavigation : adminNavigation;
  return <AuthGuard audience={audience}><div className="min-h-screen bg-[#f8f7fc] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
    <aside className="hidden border-r border-violet-100 bg-white lg:fixed lg:inset-y-0 lg:flex lg:w-[248px] lg:flex-col">
      <Link className="flex h-[76px] items-center gap-2 border-b border-violet-100 px-6 text-lg font-bold text-slate-950" href="/"><span className="grid size-9 place-items-center rounded-xl bg-violet-700 text-white"><Sparkles size={18} /></span>Cosmaker<span className="-ml-2 text-violet-700">OS</span></Link>
      <div className="px-4 py-5"><p className="px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{audience === 'client' ? 'Minha conta' : audience === 'atelier' ? 'Ateliê' : 'Plataforma'}</p><nav aria-label="Navegação da área" className="mt-3 grid gap-1">{navigation.map(({ href, label, icon: Icon }) => { const active = pathname === href || (href !== '/cliente' && href !== '/atelier' && href !== '/admin' && pathname.startsWith(`${href}/`)); return <Link className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', active ? 'bg-violet-100 text-violet-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')} href={href} key={href}><Icon aria-hidden="true" size={17} strokeWidth={1.8} />{label}</Link>; })}</nav></div>
      <div className="mt-auto border-t border-slate-100 p-4"><Link className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50" href="/cliente/perfil"><Avatar className="size-9" name={user?.name ?? 'Cosmaker'} src={user?.photoURL} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user?.name}</span><span className="block text-xs text-slate-500">{user?.email}</span></span><ArrowUpRight aria-hidden="true" className="text-slate-400" size={15} /></Link><Link className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50" href="/logout"><LogOut size={16} />Sair</Link></div>
    </aside>
    <div className="min-w-0 lg:col-start-2 lg:pl-0"><header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-violet-100 bg-white/90 px-4 backdrop-blur-lg sm:px-7"><div><p className="text-xs font-medium text-slate-500">{audience === 'client' ? 'Área do cliente' : audience === 'atelier' ? 'Painel do ateliê' : 'Administração SaaS'}</p><p className="text-sm font-semibold text-slate-900">{title}</p></div><div className="flex items-center gap-2"><Link aria-label="Abrir notificações" className="grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-violet-50" href={audience === 'client' ? '/cliente/notificacoes' : '/atelier/configuracoes/notificacoes'}><Bell size={18} /></Link><Avatar className="size-9" name={user?.name ?? 'Cosmaker'} src={user?.photoURL} /><span className="hidden max-w-36 truncate text-sm font-semibold text-slate-700 sm:inline">{user?.name}</span></div></header>
      <nav aria-label="Navegação rápida" className="flex gap-1 overflow-x-auto border-b border-violet-100 bg-white px-3 py-2 lg:hidden">{navigation.map(({ href, label, icon: Icon }) => <Link className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium', pathname === href ? 'bg-violet-100 text-violet-900' : 'text-slate-600')} href={href} key={href}><Icon size={15} />{label}</Link>)}</nav>
      <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-7"><h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>{children}</main>
    </div>
  </div></AuthGuard>;
}
