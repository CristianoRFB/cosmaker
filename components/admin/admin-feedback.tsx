'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function AdminLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <Card className="border-rose-200"><CardContent className="flex flex-col items-start gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><AlertCircle className="mt-0.5 shrink-0 text-rose-600" size={19} /><div><h2 className="font-semibold text-slate-900">Não foi possível carregar os dados</h2><p className="mt-1 text-sm leading-6 text-slate-600">{message}</p></div></div><Button onClick={onRetry} variant="secondary"><RefreshCw size={15} />Tentar novamente</Button></CardContent></Card>;
}
