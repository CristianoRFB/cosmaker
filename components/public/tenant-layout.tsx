'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { usePublicTenant } from '@/providers/public-tenant-provider';

export function TenantPublicLayout({ children }: { children: ReactNode }) {
  const { tenantSlug, tenant } = usePublicTenant();
  const accent = tenant?.brandColor;
  return <div className="min-h-screen bg-[#fcfbff] text-slate-950">
    <header className="sticky top-0 z-40 border-b border-violet-100/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
        <Link aria-label={`${tenant?.name ?? 'Ateliê'}, início`} className="inline-flex min-w-0 items-center gap-3 text-lg font-bold tracking-tight" href={`/${encodeURIComponent(tenantSlug)}`}>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-700 text-white" style={accent ? { backgroundColor: accent } : undefined}><Sparkles aria-hidden="true" size={19} /></span>
          <span className="truncate">{tenant?.name ?? 'Ateliê'}</span>
        </Link>
        {tenant?.quoteRequestsEnabled ? <Link className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800" href={`/${encodeURIComponent(tenantSlug)}/orcamento`} style={accent ? { backgroundColor: accent } : undefined}>Solicitar orçamento<ArrowRight aria-hidden="true" size={16} /></Link> : null}
      </div>
    </header>
    {children}
    <footer className="border-t border-violet-100 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold" href={`/${encodeURIComponent(tenantSlug)}`}><Sparkles className="text-violet-700" size={16} />{tenant?.name ?? 'Ateliê'}</Link>
        <span className="text-xs text-slate-500">Página pública do ateliê no Cosmaker OS</span>
      </div>
    </footer>
  </div>;
}
