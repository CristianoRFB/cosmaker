'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Tabs({ items, initial = 0 }: { items: Array<{ label: string; content: ReactNode }>; initial?: number }) {
  const [active, setActive] = useState(initial);
  return <div><div aria-label="Seções" className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">{items.map((item, index) => <button aria-selected={active === index} className={cn('shrink-0 border-b-2 px-4 py-3 text-sm font-medium', active === index ? 'border-violet-600 text-violet-800' : 'border-transparent text-slate-500 hover:text-slate-800')} key={item.label} onClick={() => setActive(index)} role="tab" type="button">{item.label}</button>)}</div><div className="pt-5" role="tabpanel">{items[active]?.content}</div></div>;
}
