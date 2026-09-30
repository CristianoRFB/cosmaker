'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAtelierQuoteRequest } from '@/features/quotes/use-quote-workspace';
import { categoryLabel, formatDate, formatMoney, itemCategoryLabel } from '@/features/quotes/quote-format';
import { calculateQuoteTotal } from '@/lib/calculations/quote-total';
import { createQuoteDraft } from '@/repositories/quotes.repository';
import { quoteDraftSchema, type QuoteItemInput } from '@/schemas/quote.schema';
import { useTenant } from '@/providers/tenant-provider';

type EditableItem = QuoteItemInput;
const today = new Date();
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const defaultValidity = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 15);

export default function NewQuotePage() {
  const router = useRouter();
  const { atelierId, membershipValid } = useTenant();
  const [requestId, setRequestId] = useState('');
  const [items, setItems] = useState<EditableItem[]>([{ description: '', category: 'material', quantity: 1, unitPrice: 0 }]);
  const [urgencyFee, setUrgencyFee] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [validUntil, setValidUntil] = useState(localDate(defaultValidity));
  const [expectedStartDate, setExpectedStartDate] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [depositPercentage, setDepositPercentage] = useState(30);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setRequestId(new URLSearchParams(window.location.search).get('solicitacaoId') ?? ''); }, []);
  const { record, loading: requestLoading, error: requestError } = useAtelierQuoteRequest(requestId);
  const costs = useMemo(() => items.reduce((result, item) => {
    const itemTotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
    if (item.category === 'material') result.materialsCost += itemTotal;
    else if (item.category === 'labor') result.laborCost += itemTotal;
    else result.otherCost += itemTotal;
    return result;
  }, { materialsCost: 0, laborCost: 0, otherCost: 0 }), [items]);
  const total = useMemo(() => {
    try { return calculateQuoteTotal({ ...costs, urgencyFee, shipping, discount, depositPercentage }); }
    catch { return null; }
  }, [costs, urgencyFee, shipping, discount, depositPercentage]);

  function updateItem(index: number, key: keyof EditableItem, value: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex !== index ? item : {
      ...item,
      [key]: key === 'description' ? value : key === 'category' ? value as EditableItem['category'] : Number(value),
    }));
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setFieldErrors({});
    if (!atelierId || !membershipValid) { setError('O contexto do ateliê não está disponível. Atualize a sessão e tente novamente.'); return; }
    const result = quoteDraftSchema.safeParse({ requestId, items, urgencyFee, shipping, discount, validUntil, expectedStartDate: expectedStartDate || undefined, expectedCompletionDate: expectedCompletionDate || undefined, depositPercentage });
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) next[String(issue.path[0] ?? 'form')] = issue.message;
      setFieldErrors(next);
      return;
    }
    setSaving(true);
    try {
      const quote = await createQuoteDraft(atelierId, result.data);
      router.push(`/atelier/orcamentos/${encodeURIComponent(quote.quoteId)}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o orçamento. Tente novamente.');
    } finally { setSaving(false); }
  }

  if (!requestId) return <Card className="p-6"><h2 className="text-lg font-semibold">Selecione uma solicitação</h2><p className="mt-2 text-sm leading-6 text-slate-600">O orçamento precisa estar ligado a uma solicitação recebida pelo ateliê.</p><Link className="mt-4 inline-flex font-semibold text-violet-700" href="/atelier/solicitacoes">Ver solicitações</Link></Card>;
  if (requestLoading) return <div className="grid gap-4"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div>;
  if (requestError || !record) return <Card className="p-6"><p className="text-sm text-rose-800">{requestError || 'Solicitação não encontrada ou sem acesso.'}</p><Link className="mt-4 inline-flex font-semibold text-violet-700" href="/atelier/solicitacoes">Voltar às solicitações</Link></Card>;

  const request = record.request;
  return <form className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]" noValidate onSubmit={saveDraft}>
    <div className="grid content-start gap-5">
      <Card className="p-5 sm:p-6"><Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700" href={`/atelier/solicitacoes/${encodeURIComponent(request.id)}`}><ArrowLeft size={15} />Solicitação</Link><h2 className="mt-4 text-xl font-semibold">{request.character} <span className="font-normal text-slate-400">·</span> {request.name}</h2><p className="mt-1 text-sm text-slate-600">{request.franchise} · {categoryLabel[request.category] ?? request.category} · entrega desejada em {formatDate(request.desiredDeliveryDate)}</p></Card>

      <Card className="p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-700">Composição</p><h2 className="mt-1 text-lg font-semibold">Itens do orçamento</h2></div><Button onClick={() => setItems((current) => [...current, { description: '', category: 'material', quantity: 1, unitPrice: 0 }])} type="button" variant="secondary"><Plus size={16} />Adicionar item</Button></div>
        <div className="mt-5 grid gap-3">{items.map((item, index) => <div className="grid gap-3 rounded-xl border border-slate-100 p-3 sm:grid-cols-[minmax(0,1fr)_150px_95px_130px_auto] sm:items-end" key={index}>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Descrição<Input aria-label={`Descrição do item ${index + 1}`} maxLength={160} onChange={(event) => updateItem(index, 'description', event.target.value)} placeholder="Ex.: espuma EVA e acabamento" value={item.description} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Categoria<Select aria-label={`Categoria do item ${index + 1}`} onChange={(event) => updateItem(index, 'category', event.target.value)} value={item.category}><option value="material">Material</option><option value="labor">Mão de obra</option><option value="other">Outro</option></Select></label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Quantidade<Input aria-label={`Quantidade do item ${index + 1}`} min="0.01" onChange={(event) => updateItem(index, 'quantity', event.target.value)} step="0.01" type="number" value={item.quantity || ''} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Preço unitário<Input aria-label={`Preço unitário do item ${index + 1}`} min="0" onChange={(event) => updateItem(index, 'unitPrice', event.target.value)} step="0.01" type="number" value={item.unitPrice || ''} /></label>
          <Button aria-label={`Remover item ${index + 1}`} className="text-rose-700" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button" variant="ghost"><Trash2 size={17} /></Button>
          <p className="text-right text-xs font-semibold text-slate-500 sm:col-span-5">{itemCategoryLabel[item.category]} <span className="px-1">·</span> Total do item: {formatMoney(Math.round(item.quantity * item.unitPrice * 100) / 100)}</p>
        </div>)}</div>
        {fieldErrors.items ? <p className="mt-3 text-sm text-rose-700" role="alert">{fieldErrors.items}</p> : null}
      </Card>

      <Card className="p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-700">Condições</p><h2 className="mt-1 text-lg font-semibold">Prazos e pagamento</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Taxa de urgência" error={fieldErrors.urgencyFee}><Input min="0" onChange={(event) => setUrgencyFee(Number(event.target.value))} step="0.01" type="number" value={urgencyFee || ''} /></Field>
        <Field label="Frete" error={fieldErrors.shipping}><Input min="0" onChange={(event) => setShipping(Number(event.target.value))} step="0.01" type="number" value={shipping || ''} /></Field>
        <Field label="Desconto" error={fieldErrors.discount}><Input min="0" onChange={(event) => setDiscount(Number(event.target.value))} step="0.01" type="number" value={discount || ''} /></Field>
        <Field label="Entrada (%)" error={fieldErrors.depositPercentage}><Input max="100" min="0" onChange={(event) => setDepositPercentage(Number(event.target.value))} step="1" type="number" value={depositPercentage} /></Field>
        <Field label="Válido até" error={fieldErrors.validUntil}><Input min={localDate(today)} onChange={(event) => setValidUntil(event.target.value)} type="date" value={validUntil} /></Field>
        <Field label="Previsão de início" error={fieldErrors.expectedStartDate}><Input min={localDate(today)} onChange={(event) => setExpectedStartDate(event.target.value)} type="date" value={expectedStartDate} /></Field>
        <Field label="Previsão de conclusão" error={fieldErrors.expectedCompletionDate}><Input min={localDate(today)} onChange={(event) => setExpectedCompletionDate(event.target.value)} type="date" value={expectedCompletionDate} /></Field>
      </div></Card>
    </div>

    <aside className="grid content-start gap-4">
      <Card className="p-5"><h2 className="text-sm font-semibold text-slate-700">Resumo da proposta</h2><dl className="mt-4 grid gap-3 text-sm"><Row label="Materiais" value={formatMoney(costs.materialsCost)} /><Row label="Mão de obra" value={formatMoney(costs.laborCost)} />{costs.otherCost ? <Row label="Outros itens" value={formatMoney(costs.otherCost)} /> : null}<Row label="Urgência" value={formatMoney(urgencyFee)} /><Row label="Frete" value={formatMoney(shipping)} /><Row label="Desconto" value={`− ${formatMoney(discount)}`} /><div className="border-t border-slate-100 pt-3"><Row label="Total" value={total ? formatMoney(total.total) : '—'} bold /></div><Row label={`Entrada (${depositPercentage || 0}%)`} value={total ? formatMoney(total.depositAmount) : '—'} /></dl></Card>
      <div className="grid gap-2">{error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p> : null}<Button className="w-full" disabled={saving || !membershipValid} type="submit">{saving ? 'Salvando…' : 'Salvar rascunho'}{!saving ? <ArrowRight size={16} /> : null}</Button><p className="text-center text-xs leading-5 text-slate-500">Salvar mantém a proposta como rascunho. O cliente só a verá depois que você disponibilizar o orçamento.</p></div>
    </aside>
  </form>;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-slate-700">{label}{children}{error ? <span className="text-xs font-normal text-rose-700">{error}</span> : null}</label>;
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex items-center justify-between gap-3 ${bold ? 'text-base font-bold text-slate-950' : 'text-slate-600'}`}><dt>{label}</dt><dd>{value}</dd></div>;
}
