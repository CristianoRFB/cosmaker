import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

export function EmptyState({ title = 'Ainda não há itens por aqui', description = 'Quando houver novidades, elas aparecerão nesta área.', action, icon }: { title?: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return <Card className="grid justify-items-center px-6 py-12 text-center"><div aria-hidden="true" className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">{icon ?? '✦'}</div><h2 className="text-lg font-semibold text-slate-950">{title}</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</Card>;
}
