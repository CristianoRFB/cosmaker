'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/providers/tenant-provider';
import { listFinanceWorkspace, recordFinanceEntry, reverseFinanceEntry } from '@/repositories/finance.repository';
import type { FinanceEntry, FinanceEntryInput, FinanceWorkspaceData } from '@/types/finance';

type View = 'overview' | 'expenses' | 'income' | 'payments' | 'reports';
const categories = { materials: 'Materiais', production: 'Produção', labor: 'Mão de obra', operational: 'Despesas operacionais', shipping: 'Entrega', fees: 'Taxas declaradas', other: 'Outros' };
const titles: Record<View, string> = { overview: 'Financeiro operacional', expenses: 'Custos e despesas', income: 'Receitas', payments: 'Recebimentos manuais', reports: 'Resultados financeiros' };
const paths: Array<[View, string, string]> = [['overview', '/atelier/financeiro', 'Visão geral'], ['expenses', '/atelier/financeiro/despesas', 'Despesas'], ['income', '/atelier/financeiro/receitas', 'Receitas'], ['payments', '/atelier/financeiro/pagamentos', 'Recebimentos'], ['reports', '/atelier/financeiro/relatorios', 'Resultados']];
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
function message(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível concluir a operação. Tente novamente.'; }
function parseMoney(value: string) {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) throw new Error('Informe o valor com até duas casas decimais.');
  const [whole, decimal = ''] = value.replace(',', '.').split('.');
  const amount = Number(BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0')));
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Informe um valor positivo e válido.');
  return amount;
}

export function FinanceWorkspace({ view = 'overview', orderId }: { view?: View; orderId?: string }) {
  const { atelierId, loading: tenantLoading, membershipValid, hasPermission } = useTenant();
  const allowed = membershipValid && (hasPermission('finance:read') || hasPermission('finance:write'));
  const canWrite = hasPermission('finance:write');
  const [workspace, setWorkspace] = useState<FinanceWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dialog, setDialog] = useState<'entry' | 'reverse' | null>(null);
  const [target, setTarget] = useState<FinanceEntry | null>(null);
  const [form, setForm] = useState({ kind: 'expense', basis: 'actual', category: 'materials', value: '', description: '', effectiveDate: today(), orderId: orderId ?? '', method: 'pix', reference: '', reason: '' });
  const requestKey = useRef({ id: '', fingerprint: '' });
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const filters = useCallback(() => ({ ...(orderId ? { orderId } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }), [orderId, from, to]);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true); setError('');
    try {
      const data = await listFinanceWorkspace(filters());
      if (generation.current === current) setWorkspace(data);
    } catch (err) { if (generation.current === current) { setWorkspace(null); setError(message(err)); } }
    finally { if (generation.current === current) setLoading(false); }
  }, [filters]);
  useEffect(() => {
    setWorkspace(null); setNotice(''); setDialog(null);
    if (!tenantLoading && allowed && atelierId) void load();
    else setLoading(false);
    return invalidate;
  }, [atelierId, allowed, tenantLoading, load, invalidate]);

  function openEntry() {
    setForm({ kind: view === 'income' ? 'income' : view === 'payments' ? 'payment' : 'expense', basis: 'actual', category: 'materials', value: '', description: '', effectiveDate: today(), orderId: orderId ?? '', method: 'pix', reference: '', reason: '' });
    requestKey.current = { id: '', fingerprint: '' }; setError(''); setDialog('entry');
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const payload = dialog === 'reverse' ? { entryId: target!.id, reason: form.reason, effectiveDate: form.effectiveDate } : {
        kind: form.kind as FinanceEntryInput['kind'], basis: (form.kind === 'payment' ? 'actual' : form.basis) as FinanceEntryInput['basis'],
        category: form.category as FinanceEntryInput['category'], amountCents: parseMoney(form.value), description: form.description,
        effectiveDate: form.effectiveDate, orderId: form.kind === 'income' ? null : form.orderId || null,
        method: form.kind === 'payment' ? form.method : null, reference: form.reference || null,
      };
      const fingerprint = JSON.stringify([dialog, payload]);
      if (requestKey.current.fingerprint !== fingerprint) requestKey.current = { id: crypto.randomUUID(), fingerprint };
      if (typeof payload.entryId === 'string') await reverseFinanceEntry(payload as { entryId: string; reason: string; effectiveDate: string }, requestKey.current.id);
      else await recordFinanceEntry(payload, requestKey.current.id);
      setDialog(null); requestKey.current = { id: '', fingerprint: '' };
      setNotice('Registro salvo. Saldos e histórico atualizados.'); await load();
    } catch (err) { setError(message(err)); } finally { setSaving(false); }
  }
  async function more() {
    if (!workspace?.nextCursor || saving) return;
    setSaving(true); setError('');
    const current = generation.current;
    try {
      const data = await listFinanceWorkspace({ ...filters(), cursor: workspace.nextCursor });
      if (current === generation.current) setWorkspace((previous) => previous ? { ...data, entries: [...previous.entries, ...data.entries] } : data);
    } catch (err) { setError(message(err)); } finally { setSaving(false); }
  }
  if (tenantLoading) return <Skeleton className="h-80 rounded-2xl" />;
  if (!allowed) return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Seu perfil não tem permissão para acessar o financeiro deste ateliê.</p>;
  const summary = workspace?.summary;
  const entries = workspace?.entries.filter((entry) => view === 'expenses' ? entry.kind === 'expense' : view === 'income' ? entry.kind === 'income' : view === 'payments' ? entry.kind === 'payment' : true) ?? [];
  return <section className="grid min-w-0 gap-5">
    {orderId && <Link className="text-sm font-semibold text-violet-700" href={`/atelier/pedidos/${encodeURIComponent(orderId)}`}>← Voltar ao pedido e à confirmação da entrada</Link>}
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-950">{orderId ? 'Financeiro do pedido' : titles[view]}</h1><p className="mt-1 max-w-2xl text-sm text-slate-600">Planejamento, custos realizados e recebimentos declarados pela equipe. Cada correção preserva o registro original.</p></div>{canWrite && <Button onClick={openEntry}>Novo lançamento</Button>}</div>
    <nav aria-label="Áreas do financeiro" className="flex flex-wrap gap-2">{paths.map(([key, path, title]) => <Link aria-current={!orderId && view === key ? 'page' : undefined} className={`rounded-xl px-3 py-2.5 text-sm font-medium ${!orderId && view === key ? 'bg-violet-100 text-violet-800' : 'bg-white text-slate-700 hover:bg-slate-100'}`} href={path} key={key}>{title}</Link>)}</nav>
    <div className="flex flex-wrap items-end gap-3"><Field label="Lançamentos desde"><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field><Field label="Até"><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field><Button variant="secondary" disabled={loading} onClick={() => void load()}>Atualizar</Button></div>
    <p className="text-xs text-slate-500">O período filtra os lançamentos e custos. Acordos, recebimentos de pedidos e saldos mostram a posição atual. Planejado e realizado são comparativos separados.</p>
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {loading ? <Skeleton className="h-64 rounded-2xl" /> : summary && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{([
        ['Receita contratada e prevista', summary.revenueCents], ['Recebimentos confirmados', summary.receivedCents],
        ['Custos planejados', summary.plannedCostsCents], ['Custos realizados', summary.actualCostsCents],
        ['Resultado planejado', summary.plannedResultCents], ['Resultado de caixa declarado', summary.actualResultCents],
      ] as Array<[string, number]>).map(([label, value]) => <Card key={label}><CardContent className="p-5"><p className="text-sm text-slate-600">{label}</p><p className={`mt-2 text-xl font-bold ${value < 0 ? 'text-rose-700' : 'text-slate-950'}`}>{money(value)}</p></CardContent></Card>)}</div>
      <Card><CardHeader><CardTitle>Margens por pedido</CardTitle></CardHeader><CardContent><div className="grid gap-3">{summary.byOrder.length ? summary.byOrder.map((order) => <article className="rounded-xl border border-slate-200 p-4" key={order.id}><div className="flex flex-wrap justify-between gap-2"><Link className="font-semibold text-violet-700" href={`/atelier/pedidos/${encodeURIComponent(order.id)}/financeiro`}>{order.character}</Link><span className="text-sm text-slate-600">Margem sobre o acordo: {order.marginBasisPoints === null ? 'Sem receita' : `${(order.marginBasisPoints / 100).toLocaleString('pt-BR')}%`}</span></div><dl className="mt-3 grid grid-cols-2 gap-3 text-sm lg:grid-cols-5">{[['Acordo', order.revenueCents], ['Recebido', order.receivedCents], ['Saldo', order.remainingCents], ['Custo realizado', order.actualCostsCents], ['Resultado', order.resultCents]].map(([label, value]) => <div key={String(label)}><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{money(Number(value))}</dd></div>)}</dl></article>) : <p className="text-sm text-slate-500">Nenhum pedido disponível.</p>}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>Histórico de lançamentos</CardTitle></CardHeader><CardContent><div className="grid gap-3">{entries.length ? entries.map((entry) => <article className="rounded-xl border border-slate-200 p-4" key={entry.id}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold text-slate-900">{entry.description}</p><p className="mt-1 text-sm text-slate-600">{entry.effectiveDate} · {entry.kind === 'payment' ? 'Recebimento manual' : entry.kind === 'expense' ? categories[entry.category] : 'Receita avulsa'} · {entry.basis === 'planned' ? 'Planejado' : 'Realizado'}</p>{entry.orderId && <p className="mt-1 break-all text-xs text-slate-500">Pedido {entry.orderId}</p>}{entry.reference && <p className="mt-1 break-words text-xs text-slate-500">Referência: {entry.reference}</p>}{entry.reason && <p className="mt-1 break-words text-sm text-slate-600">Motivo: {entry.reason}</p>}{entry.reversed && <p className="mt-1 text-xs font-semibold text-amber-700">Compensado · original preservado</p>}</div><strong className="text-slate-900">{money(entry.amountCents)}</strong></div>{canWrite && !entry.reversed && !entry.reversesEntryId && <Button className="mt-3" variant="secondary" onClick={() => { setTarget(entry); setForm((current) => ({ ...current, reason: '', effectiveDate: today() })); requestKey.current = { id: '', fingerprint: '' }; setError(''); setDialog('reverse'); }}>Corrigir lançamento</Button>}</article>) : <p className="text-sm text-slate-500">Nenhum lançamento nesta página para o filtro selecionado.</p>}</div>{workspace.nextCursor && <Button className="mt-4" variant="secondary" disabled={saving} onClick={() => void more()}>Carregar mais lançamentos</Button>}<p className="mt-4 text-xs text-slate-500">{workspace.filteredCount} lançamentos no período. Recebimentos legados permanecem no histórico do pedido e no saldo atual.</p></CardContent></Card>
    </>}
    {dialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3" onKeyDown={(event) => { if (event.key === 'Escape' && !saving) setDialog(null); }}><section role="dialog" aria-modal="true" aria-labelledby="finance-dialog-title" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><h2 className="text-xl font-bold text-slate-950" id="finance-dialog-title">{dialog === 'reverse' ? 'Corrigir com compensação' : 'Novo lançamento financeiro'}</h2><p className="mt-2 text-sm text-slate-600">{dialog === 'reverse' ? 'O lançamento original será mantido e um valor inverso será registrado. Depois, registre o valor correto se necessário. A produção mantém seu histórico.' : 'Pagamentos de pedidos são declarações manuais de recebimento.'}</p>
      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        {dialog === 'entry' && <><Field label="Tipo"><select className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><option value="expense">Custo ou despesa</option><option value="income" disabled={Boolean(orderId)}>Receita avulsa</option><option value="payment">Recebimento de pedido</option></select></Field><Field label="Situação"><select disabled={form.kind === 'payment'} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm" value={form.kind === 'payment' ? 'actual' : form.basis} onChange={(event) => setForm({ ...form, basis: event.target.value })}><option value="planned">Planejado</option><option value="actual">Realizado</option></select></Field>
          <Field label="Categoria"><select className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Valor (R$)"><Input inputMode="decimal" required value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} /></Field>
          <Field label="Descrição" wide><Input autoFocus required minLength={3} maxLength={300} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          {form.kind !== 'income' && <Field label="Pedido" wide><select required={form.kind === 'payment'} disabled={Boolean(orderId)} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm" value={form.orderId} onChange={(event) => setForm({ ...form, orderId: event.target.value })}><option value="">Despesa geral do ateliê</option>{workspace?.summary.byOrder.map((order) => <option key={order.id} value={order.id}>{order.character}</option>)}</select></Field>}
          {form.kind === 'payment' && <Field label="Meio declarado"><select className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm" value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}><option value="pix">Pix</option><option value="bank_transfer">Transferência</option><option value="cash">Dinheiro</option><option value="other">Outro</option></select></Field>}
          <Field label="Referência interna"><Input maxLength={120} value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} /></Field></>}
        <Field label="Data do lançamento"><Input required type="date" value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} /></Field>
        {dialog === 'reverse' && <Field label="Motivo da correção" wide><textarea autoFocus required minLength={8} maxLength={500} className="min-h-24 rounded-xl border border-slate-300 p-3 text-sm" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></Field>}
        {error && <p role="alert" className="text-sm text-rose-700 sm:col-span-2">{error}</p>}<div className="flex justify-end gap-3 sm:col-span-2"><Button variant="secondary" type="button" disabled={saving} onClick={() => setDialog(null)}>Cancelar</Button><Button disabled={saving} type="submit">{saving ? 'Salvando…' : dialog === 'reverse' ? 'Registrar compensação' : 'Salvar lançamento'}</Button></div>
      </form></section></div>}
  </section>;
}
function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`grid min-w-0 gap-1.5 text-sm font-medium text-slate-700 ${wide ? 'sm:col-span-2' : ''}`}><span>{label}</span>{children}</label>;
}
