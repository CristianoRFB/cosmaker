'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTenant } from '@/providers/tenant-provider';
import { getQuote, type QuoteDetailRecord } from '@/repositories/quotes.repository';
import { QuoteEditor } from '@/components/quotes/quote-editor';
import { Card } from '@/components/ui/card';

export default function EditarOrçamento() {
  const { orcamentoId } = useParams<{ orcamentoId: string }>();
  const { atelierId, membershipValid, hasPermission } = useTenant();
  const allowed = hasPermission('quotes:write');
  const [state, setState] = useState<{ key: string; record: QuoteDetailRecord | null; error: string }>({ key: '', record: null, error: '' });
  const key = `${atelierId}/${orcamentoId}`;
  useEffect(() => {
    let active = true;
    if (!atelierId || !membershipValid || !allowed) return;
    void getQuote(atelierId, orcamentoId).then(record => { if (active) setState({ key, record, error: record ? '' : 'Orçamento não encontrado.' }); })
      .catch(() => { if (active) setState({ key, record: null, error: 'Não foi possível abrir o orçamento. Confira sua conexão e seu acesso.' }); });
    return () => { active = false; };
  }, [atelierId, membershipValid, allowed, orcamentoId, key]);
  if (!allowed) return <p role="alert">Seu perfil não tem permissão para revisar orçamentos.</p>;
  if (state.key !== key) return <p role="status">Carregando orçamento…</p>;
  if (state.error || !state.record) return <Card className="p-5"><p role="alert">{state.error}</p><Link className="inline-flex min-h-11 items-center font-semibold text-violet-700 underline" href="/atelier/orcamentos">Voltar aos orçamentos</Link></Card>;
  if (state.record.quote.status === 'approved') return <Card className="p-5"><h1 className="text-xl font-semibold">Proposta aprovada</h1><p className="mt-3 text-sm text-slate-600">As alterações do projeto aprovado são registradas como revisões no pedido.</p><Link className="inline-flex min-h-11 items-center font-semibold text-violet-700 underline" href={`/atelier/pedidos/${encodeURIComponent(orcamentoId)}`}>Abrir pedido e suas revisões</Link></Card>;
  return <section className="grid gap-5"><h1 className="text-2xl font-semibold">Revisar orçamento</h1><QuoteEditor key={key} initialRecord={state.record} /></section>;
}
