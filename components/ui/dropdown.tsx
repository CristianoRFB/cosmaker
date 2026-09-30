import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Dropdown({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return <details className={cn('group relative inline-block', className)}><summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 marker:hidden [&::-webkit-details-marker]:hidden">{label}<span aria-hidden="true" className="text-xs text-slate-400">⌄</span></summary><div className="absolute right-0 z-30 mt-2 min-w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">{children}</div></details>;
}
