'use client';

import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Bell, CircleHelp, LogOut, Menu, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { currentSection, navigationFor, searchNavigation, type WorkspaceItem } from '@/lib/navigation/workspace';
import { Avatar } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AuthGuard, type Audience } from './auth-guard';
import { useAuth } from '@/providers/auth-provider';
import { useTenant } from '@/providers/tenant-provider';
import { TenantCommercialBanner } from '@/components/commercial/tenant-commercial-banner';

function AreaLinks({ items, activeHref, onNavigate, descriptions = false }: { items: WorkspaceItem[]; activeHref?: string; onNavigate?: () => void; descriptions?: boolean }) {
  return <div className="grid gap-5">{[...new Set(items.map((item) => item.group))].map((group) => <div key={group}>
    <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{group}</p>
    <ul className="grid gap-1">{items.filter((item) => item.group === group).map(({ href, label, description }) => <li key={href}>
      <Link aria-current={activeHref === href ? 'page' : undefined} className={cn('flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition', activeHref === href ? 'bg-violet-100 font-semibold text-violet-900' : 'text-slate-700 hover:bg-slate-50')} href={href} onClick={onNavigate}>
        <span><span className="block font-medium">{label}</span>{descriptions ? <span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span> : null}</span>
        {descriptions ? <ArrowUpRight aria-hidden="true" className="shrink-0" size={16} /> : null}
      </Link>
    </li>)}</ul>
  </div>)}</div>;
}

export function WorkspaceLayout({ audience, title, children }: { audience: Audience; title: string; children: ReactNode }) {
  const { user } = useAuth();
  const { hasPermission } = useTenant();
  const pathname = usePathname();
  const [panel, setPanel] = useState<{ type: 'menu' | 'help'; pathname: string } | null>(null);
  const [query, setQuery] = useState('');
  const menuId = useId(); const helpId = useId(); const searchId = useId();
  const navigation = navigationFor(audience, hasPermission);
  const section = currentSection(navigation, pathname);
  const pageTitle = section?.label ?? title;
  const home = audience === 'client' ? '/cliente' : audience === 'atelier' ? '/atelier' : '/admin';
  const profile = audience === 'client' ? '/cliente/perfil' : audience === 'atelier' && hasPermission('atelier:settings') ? '/atelier/configuracoes' : home;
  const area = audience === 'client' ? 'Área do cliente' : audience === 'atelier' ? 'Painel do ateliê' : 'Administração da plataforma';
  const openPanel = (type: 'menu' | 'help') => { setQuery(''); setPanel({ type, pathname }); };
  const closePanel = () => setPanel(null);
  const visible = searchNavigation(navigation, query);
  // A route change makes an existing panel inactive without a state update during render.
  const menuOpen = panel?.type === 'menu' && panel.pathname === pathname;
  const helpOpen = panel?.type === 'help' && panel.pathname === pathname;

  return <AuthGuard audience={audience}><div className="min-h-screen bg-[#f8f7fc] lg:grid lg:content-start lg:grid-cols-[248px_minmax(0,1fr)]">
    <a className="skip-link" href="#workspace-content">Pular para o conteúdo</a>
    {process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' ? <div className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-bold text-amber-950 lg:col-span-2">AMBIENTE LOCAL · dados fictícios nos emuladores Firebase</div> : null}
    <aside className="hidden border-r border-violet-100 bg-white lg:fixed lg:inset-y-0 lg:flex lg:w-[248px] lg:flex-col">
      <Link aria-label="Cosmaker OS, minha área" className="flex h-[76px] shrink-0 items-center gap-2 border-b border-violet-100 px-6 text-lg font-bold text-slate-950" href={home}><span className="grid size-9 place-items-center rounded-xl bg-violet-700 text-white"><Sparkles aria-hidden="true" size={18} /></span>Cosmaker<span className="-ml-2 text-violet-700">OS</span></Link>
      <nav aria-label="Navegação da área" className="min-h-0 flex-1 overflow-y-auto px-4 py-5"><AreaLinks activeHref={section?.href} items={navigation} /></nav>
      <div className="shrink-0 border-t border-slate-100 p-4">
        <Link className="flex min-h-11 items-center gap-3 rounded-xl p-2 hover:bg-slate-50" href={profile}><Avatar className="size-9 shrink-0" name={user?.name ?? 'Cosmaker'} src={user?.photoURL} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user?.name}</span><span className="block truncate text-xs text-slate-500">{user?.email}</span></span><ArrowUpRight aria-hidden="true" className="shrink-0 text-slate-400" size={15} /></Link>
        <Link className="mt-2 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50" href="/logout"><LogOut aria-hidden="true" size={16} />Sair da conta</Link>
      </div>
    </aside>
    <div className="min-w-0 lg:col-start-2">
      <header className="sticky top-0 z-30 flex min-h-[68px] items-center justify-between gap-2 border-b border-violet-100 bg-white/95 px-4 py-2 backdrop-blur-lg sm:px-7">
        <div className="min-w-0"><p className="truncate text-xs font-medium text-slate-500">{area}</p><p className="truncate text-sm font-semibold text-slate-900">{pageTitle}</p></div>
        <div className="flex shrink-0 items-center gap-1">
          <button aria-label="Abrir menu de navegação" aria-controls={menuId} aria-expanded={menuOpen} aria-haspopup="dialog" className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-violet-800 hover:bg-violet-50 lg:hidden" onClick={() => openPanel('menu')} type="button"><Menu aria-hidden="true" size={20} />Menu</button>
          {audience === 'client' || audience === 'admin' ? <Link aria-label={audience === 'admin' ? 'Abrir auditoria' : 'Abrir notificações'} className="grid size-11 place-items-center rounded-xl text-slate-600 hover:bg-violet-50" href={audience === 'client' ? '/cliente/notificacoes' : '/admin/logs'}><Bell aria-hidden="true" size={18} /></Link> : null}
          <Link aria-label="Abrir minha área" className="grid size-11 place-items-center rounded-xl hover:bg-violet-50" href={profile}><Avatar className="size-9" name={user?.name ?? 'Cosmaker'} src={user?.photoURL} /></Link>
        </div>
      </header>
      <Dialog id={menuId} open={menuOpen} onClose={closePanel} title="Navegação">
        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700" htmlFor={searchId}><Search aria-hidden="true" size={16} />Encontrar uma área</label>
        <Input autoComplete="off" id={searchId} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: orçamento, pedidos…" type="search" value={query} />
        <p aria-live="polite" className="my-3 text-xs text-slate-500">{visible.length ? `${visible.length} áreas disponíveis para sua conta` : 'Nenhuma área encontrada'}</p>
        {!visible.length ? <button className="mb-4 min-h-11 text-sm font-semibold text-violet-700" type="button" onClick={() => setQuery('')}>Limpar busca</button> : null}
        <nav aria-label="Todas as áreas da conta"><AreaLinks activeHref={section?.href} descriptions items={visible} onNavigate={closePanel} /></nav>
        <div className="mt-5 grid gap-2 border-t border-slate-100 pt-4"><Link className="flex min-h-11 items-center gap-2 px-3 text-sm font-semibold text-slate-700" href={profile} onClick={closePanel}>Abrir minha área</Link><Link className="flex min-h-11 items-center gap-2 px-3 text-sm text-slate-700" href="/logout" onClick={closePanel}><LogOut aria-hidden="true" size={16} />Sair da conta</Link></div>
      </Dialog>
      <Dialog id={helpId} open={helpOpen} onClose={closePanel} title="Como usar esta área">
        <p className="mb-5 text-sm leading-6 text-slate-600">{audience === 'client' ? 'Use os orçamentos para conferir propostas e os pedidos para acompanhar projetos confirmados.' : audience === 'atelier' ? 'O atendimento começa nas solicitações. As propostas ficam em Orçamentos; os projetos confirmados, em Pedidos e Produção.' : 'Gerencie ateliês, acompanhe atribuições comerciais e confira o histórico em Auditoria.'} As opções abaixo seguem as permissões da sua conta.</p>
        <nav aria-label="Guia das áreas"><AreaLinks activeHref={section?.href} descriptions items={navigation} onNavigate={closePanel} /></nav>
      </Dialog>
      <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-7" id="workspace-content" tabIndex={-1}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div className="min-w-0">
          {section && pathname !== section.href ? <Link className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet-700" href={section.href}><ArrowLeft aria-hidden="true" size={16} />Voltar para {section.label}</Link> : null}
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{pageTitle}</h1>
          {section ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{section.description}</p> : null}
        </div><button aria-controls={helpId} aria-haspopup="dialog" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 text-sm font-semibold text-violet-800 hover:bg-violet-50" onClick={() => openPanel('help')} type="button"><CircleHelp aria-hidden="true" size={17} />Como usar esta área</button></div>
        {audience === 'atelier' ? <TenantCommercialBanner /> : null}{children}
      </main>
    </div>
  </div></AuthGuard>;
}
