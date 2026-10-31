'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';

const links = [{ href: '/portfolio', label: 'Portfólio' }, { href: '/servicos', label: 'Serviços' }, { href: '/agenda', label: 'Agenda' }, { href: '/sobre', label: 'Sobre' }];
export function PublicSiteMenu() {
  const id = useId(); const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  return <>
    <nav aria-label="Navegação principal" className="hidden items-center gap-5 text-sm font-medium text-slate-600 md:flex">{links.map(({ href, label }) => <Link aria-current={pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined} className="inline-flex min-h-11 items-center hover:text-violet-700" href={href} key={href}>{label}</Link>)}</nav>
    <button aria-label="Abrir menu do site" aria-controls={id} aria-expanded={open} aria-haspopup="dialog" className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl px-2 text-sm font-semibold text-violet-800 hover:bg-violet-50 md:hidden" onClick={() => setOpenedAt(pathname)} type="button"><Menu aria-hidden="true" size={20} /><span className="hidden min-[360px]:inline">Menu</span></button>
    <Dialog id={id} open={open} onClose={() => setOpenedAt(null)} title="Explorar o Cosmaker"><nav aria-label="Páginas do site"><ul className="grid gap-2">{[...links, { href: '/login', label: 'Entrar na minha conta' }, { href: '/cadastro', label: 'Criar conta de cliente' }].map(({ href, label }) => <li key={href}><Link aria-current={pathname === href ? 'page' : undefined} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-violet-50" href={href} onClick={() => setOpenedAt(null)}>{label}</Link></li>)}</ul></nav></Dialog>
  </>;
}
