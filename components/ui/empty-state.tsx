import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-violet-200 bg-white px-6 py-10 text-center">
    <div className="max-w-md"><span className="mx-auto mb-4 grid size-11 place-items-center rounded-2xl bg-violet-50 text-violet-700"><Inbox size={19} /></span><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</div>
  </div>;
}
