'use client';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

const links = [['Portfólio', '/portfolio'], ['Serviços', '/servicos'], ['Agenda e disponibilidade', '/agenda'], ['Sobre', '/sobre'], ['Contato com o ateliê', '/contato']] as const;
export function PublicSiteMenu() {
  const [open, setOpen] = useState(false); const id = useId(); const root = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div ref={root} className="relative lg:hidden"><button ref={trigger} type="button" aria-label="Abrir menu do site" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} className="grid size-11 place-items-center rounded-xl text-violet-800 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"><Menu aria-hidden="true" size={21} /></button>
    {open ? <nav id={id} aria-label="Navegação pública" className="absolute right-0 top-14 z-50 grid max-h-[70vh] w-[min(18rem,calc(100vw-2rem))] gap-1 overflow-y-auto rounded-2xl border border-violet-100 bg-white p-3 shadow-xl">{links.map(([name, href]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-violet-50">{name}</Link>)}</nav> : null}
  </div>;
}
