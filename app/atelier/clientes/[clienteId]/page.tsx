'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, BriefcaseBusiness, CalendarClock, ClipboardList, FileText, MessageSquareText, Pencil, Ruler, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { addAtelierClientInteraction, getAtelierClient, saveAtelierClient } from '@/repositories/clients.repository';
import { clientInputSchema, clientInteractionSchema } from '@/schemas/client.schema';
import { useTenant } from '@/providers/tenant-provider';
import type { ClientDetail, ClientHistoryRecord } from '@/types/client';

function formatDate(value: unknown) {
  if (typeof value !== 'string' || !value) return 'Data não informada';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data não informada' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function money(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    : '—';
}

export default function AtelierClientDetailPage() {
  const params = useParams<{ clienteId: string }>();
  const clientId = typeof params.clienteId === 'string' ? decodeURIComponent(params.clienteId) : '';
  const { atelierId, loading: tenantLoading, membershipValid, hasPermission } = useTenant();
  const canRead = hasPermission('clients:read');
  const canWrite = hasPermission('clients:write');
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [interactionSaving, setInteractionSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [interactionNote, setInteractionNote] = useState('');
  const interactionRequestId = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await getAtelierClient(clientId);
      setDetail(result);
      setName(result.client.name); setEmail(result.client.email); setPhone(result.client.phone);
    } catch (requestError) {
      setError(requestError instanceof Error && requestError.message ? requestError.message : 'Não foi possível carregar a ficha do cliente.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (tenantLoading) return;
    if (!atelierId || !membershipValid || !canRead || !clientId) { setLoading(false); return; }
    void load();
  }, [atelierId, canRead, clientId, load, membershipValid, tenantLoading]);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setError(''); setNotice('');
    const parsed = clientInputSchema.safeParse({ name, email, phone });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Revise os dados informados.'); return; }
    setSaving(true);
    try {
      await saveAtelierClient(parsed.data, detail.client.id);
      setEditing(false);
      setNotice('Cadastro atualizado.');
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error && requestError.message ? requestError.message : 'Não foi possível salvar as alterações.');
    } finally { setSaving(false); }
  }

  async function submitInteraction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setError(''); setNotice('');
    const parsed = clientInteractionSchema.safeParse({ note: interactionNote });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Revise a interação.'); return; }
    interactionRequestId.current ??= window.crypto.randomUUID();
    setInteractionSaving(true);
    try {
      await addAtelierClientInteraction(detail.client.id, parsed.data.note, interactionRequestId.current);
      interactionRequestId.current = null;
      setInteractionNote(''); setNotice('Interação registrada no histórico do cliente.');
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error && requestError.message ? requestError.message : 'Não foi possível registrar a interação. Tente novamente.');
    } finally { setInteractionSaving(false); }
  }

  if (tenantLoading || loading) return <div aria-label="Carregando ficha do cliente" className="grid gap-4"><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>;
  if (!atelierId || !membershipValid) return <Feedback title="Ateliê indisponível" description="Entre com uma conta vinculada a um ateliê ativo para consultar esta ficha." />;
  if (!canRead) return <Feedback title="Acesso restrito" description="Seu perfil não tem permissão para consultar clientes deste ateliê." />;
  if (!detail) return <div className="grid gap-4"><Feedback title="Ficha indisponível" description={error || 'Este cliente não existe neste ateliê ou não está acessível ao seu perfil.'} /><Link className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-violet-200 px-4 text-sm font-semibold text-violet-800" href="/atelier/clientes"><ArrowLeft size={16} />Voltar aos clientes</Link></div>;

  const { client, history } = detail;
  return <section className="grid gap-5">
    <Link className="inline-flex min-h-10 w-fit items-center gap-2 text-sm font-semibold text-violet-800 hover:text-violet-950" href="/atelier/clientes"><ArrowLeft size={16} />Voltar aos clientes</Link>
    {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{notice}</p> : null}
    {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p> : null}

    <Card><CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><CardTitle className="text-2xl">{client.name}</CardTitle><p className="mt-2 text-sm text-slate-600">{client.email}{client.phone ? ` · ${client.phone}` : ''}</p><div className="mt-3 flex flex-wrap items-center gap-2">{client.hasLinkedAccount ? <Badge tone="green">Conta autenticada vinculada</Badge> : <Badge tone="neutral">Cadastro manual</Badge>}<span className="text-xs text-slate-500">Cliente desde {formatDate(client.createdAt)}</span></div></div>{canWrite ? <Button onClick={() => setEditing((value) => !value)} variant="secondary"><Pencil size={15} />{editing ? 'Fechar edição' : 'Editar cadastro'}</Button> : null}</CardHeader>
      {editing ? <CardContent className="border-t border-slate-100 pt-5"><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submitProfile(event)}>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">Nome<input autoComplete="name" className="min-h-11 rounded-xl border border-slate-300 px-3" maxLength={120} onChange={(event) => setName(event.target.value)} required value={name} /></label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">E-mail<input autoComplete="email" className="min-h-11 rounded-xl border border-slate-300 px-3" disabled={client.hasLinkedAccount} maxLength={254} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">Telefone <span className="font-normal text-slate-500">(opcional)</span><Input autoComplete="tel" maxLength={32} onChange={(event) => setPhone(event.target.value)} type="tel" value={phone} /></label>
        {client.hasLinkedAccount ? <p className="text-sm text-amber-800 sm:col-span-2">O e-mail vinculado fica bloqueado para edição até a pessoa confirmar o novo endereço.</p> : null}
        <div className="flex gap-2 sm:col-span-2"><Button disabled={saving} type="submit">{saving ? 'Salvando…' : 'Salvar alterações'}</Button><Button disabled={saving} onClick={() => setEditing(false)} type="button" variant="secondary">Cancelar</Button></div>
      </form></CardContent> : null}
    </Card>

    {history.access.measurements ? <Link className="inline-flex min-h-11 items-center font-semibold text-violet-700 underline" href={`/atelier/clientes/${encodeURIComponent(clientId)}/medidas`}>Gerenciar fichas de medidas</Link> : null}
    <div className="grid gap-4 lg:grid-cols-2">
      <HistoryCard title="Solicitações" icon={<ClipboardList size={18} />} rows={history.requests} empty="Nenhuma solicitação vinculada." render={(item) => <><strong>{String(item.character ?? 'Solicitação')}</strong><span className="text-slate-500">{String(item.franchise ?? '')} · {String(item.status ?? '—')}</span><time className="text-xs text-slate-500">{formatDate(item.createdAt)}</time></>} />
      <HistoryCard title="Propostas" icon={<FileText size={18} />} rows={history.quotes} empty="Nenhuma proposta vinculada." render={(item) => <><strong>Proposta {String(item.id).slice(0, 10)}</strong><span className="text-slate-500">{String(item.status ?? '—')} · {money(item.total)}</span><time className="text-xs text-slate-500">{formatDate(item.createdAt)}</time></>} />
      <HistoryCard title="Pedidos" icon={<BriefcaseBusiness size={18} />} rows={history.orders} empty="Nenhum pedido vinculado." render={(item) => <><strong>{String(item.character ?? `Pedido ${String(item.id).slice(0, 10)}`)}</strong><span className="text-slate-500">{String(item.status ?? '—')}</span>{history.access.finance ? <span className="text-xs text-slate-600">Recebido {money(item.amountPaid)} · restante {money(item.amountRemaining)}</span> : null}<time className="text-xs text-slate-500">{formatDate(item.createdAt)}</time></>} />
      {history.access.finance ? <HistoryCard title="Pagamentos internos" icon={<Wallet size={18} />} rows={history.payments} empty="Nenhum pagamento interno registrado." render={(item) => <><strong>{money(item.amount)}</strong><span className="text-slate-500">{String(item.type ?? 'Pagamento')} · {String(item.status ?? '—')}</span><time className="text-xs text-slate-500">{formatDate(item.createdAt)}</time></>} /> : <Card><CardHeader><CardTitle className="flex items-center gap-2"><Wallet size={18} />Pagamentos internos</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-600">Seu perfil não tem permissão para consultar informações financeiras.</p></CardContent></Card>}
      {history.access.measurements ? <HistoryCard title="Fichas de medidas" icon={<Ruler size={18} />} rows={history.measurements} empty="Nenhuma ficha de medidas vinculada." render={(item) => <><strong>{String(item.name ?? 'Ficha de medidas')}</strong><span className="text-slate-500">{item.active ? 'Ativa' : 'Arquivada'}</span><time className="text-xs text-slate-500">Atualizada {formatDate(item.updatedAt ?? item.createdAt)}</time></>} /> : <Card><CardHeader><CardTitle className="flex items-center gap-2"><Ruler size={18} />Fichas de medidas</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-600">Seu perfil não tem permissão para consultar medidas. Os valores sensíveis não aparecem nesta visão geral.</p></CardContent></Card>}
    </div>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareText size={18} />Interações registradas</CardTitle><p className="text-sm text-slate-600">Anotações internas para continuidade do atendimento; nenhuma mensagem externa é enviada.</p></CardHeader><CardContent className="grid gap-4">
      {history.interactions.length ? <ol className="grid gap-3">{history.interactions.map((item) => <li className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={item.id}><p className="whitespace-pre-wrap text-sm text-slate-800">{item.note}</p><p className="mt-2 text-xs text-slate-500">Registrada pela equipe · {formatDate(item.createdAt)}</p></li>)}</ol> : <p className="text-sm text-slate-600">Ainda não há interações neste histórico.</p>}
      {canWrite ? <form className="grid gap-3" onSubmit={(event) => void submitInteraction(event)}><label className="grid gap-1.5 text-sm font-medium text-slate-700" htmlFor="client-interaction">Nova anotação<textarea className="min-h-24 rounded-xl border border-slate-300 p-3 text-sm" id="client-interaction" maxLength={2000} onChange={(event) => setInteractionNote(event.target.value)} placeholder="Registre um detalhe relevante para o atendimento…" value={interactionNote} /></label><Button className="w-fit" disabled={interactionSaving || interactionNote.trim().length < 2} type="submit">{interactionSaving ? 'Registrando…' : 'Registrar interação'}</Button></form> : <p className="text-sm text-slate-600">Seu perfil não tem permissão para registrar interações.</p>}
    </CardContent></Card>
    <div className="flex items-center gap-2 text-xs text-slate-500"><CalendarClock size={14} />Dados pessoais e medidas ficam limitados às permissões da equipe.</div>
  </section>;
}

function HistoryCard({ title, icon, rows, empty, render }: { title: string; icon: ReactNode; rows: ClientHistoryRecord[]; empty: string; render: (row: ClientHistoryRecord) => ReactNode }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2">{icon}{title}<Badge tone="neutral">{rows.length}</Badge></CardTitle></CardHeader><CardContent>{rows.length ? <ol className="grid gap-3">{rows.map((row) => <li className="grid gap-1 rounded-xl border border-slate-200 p-3 text-sm" key={row.id}>{render(row)}</li>)}</ol> : <p className="text-sm text-slate-600">{empty}</p>}</CardContent></Card>;
}

function Feedback({ title, description }: { title: string; description: string }) {
  return <Card><CardContent className="p-5"><h1 className="font-semibold text-slate-950">{title}</h1><p className="mt-2 text-sm text-slate-600">{description}</p></CardContent></Card>;
}
