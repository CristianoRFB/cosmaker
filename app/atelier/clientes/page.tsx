'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, Plus, RefreshCw, Search, UsersRound, X } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { saveAtelierClient, listAtelierClients, type Client } from '@/repositories/clients.repository';
import { clientInputSchema } from '@/schemas/client.schema';
import { useTenant } from '@/providers/tenant-provider';

const PAGE_SIZE = 25;

export default function AtelierClientsPage() {
  const { atelierId, loading: tenantLoading, membershipValid, hasPermission } = useTenant();
  const canRead = hasPermission('clients:read');
  const canWrite = hasPermission('clients:write');
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const load = useCallback(async (cursor: string | null = null, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const result = await listAtelierClients({ search, cursor, limit: PAGE_SIZE });
      setClients((previous) => append ? [...previous, ...result.clients] : result.clients);
      setNextCursor(result.nextCursor);
    } catch (requestError) {
      setError(requestError instanceof Error && requestError.message ? requestError.message : 'Não foi possível carregar os clientes. Tente novamente.');
      if (!append) setClients([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search]);

  useEffect(() => {
    if (tenantLoading) return;
    if (!atelierId || !membershipValid || !canRead) {
      setClients([]);
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(() => { void load(); }, 200);
    return () => window.clearTimeout(timer);
  }, [atelierId, canRead, load, membershipValid, tenantLoading]);

  const countLabel = useMemo(() => `${clients.length} ${clients.length === 1 ? 'cliente carregado' : 'clientes carregados'}`, [clients.length]);

  function openCreateForm() {
    setEditingClient(null);
    setName(''); setEmail(''); setPhone(''); setError(''); setNotice('');
    setFormOpen(true);
  }

  function openEditForm(client: Client) {
    setEditingClient(client);
    setName(client.name); setEmail(client.email); setPhone(client.phone);
    setError(''); setNotice(''); setFormOpen(true);
  }

  async function submitClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setNotice('');
    const parsed = clientInputSchema.safeParse({ name, email, phone });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revise os dados informados.');
      return;
    }
    setSaving(true);
    try {
      await saveAtelierClient(parsed.data, editingClient?.id);
      setFormOpen(false);
      setNotice(editingClient ? 'Cadastro do cliente atualizado.' : 'Cliente cadastrado com sucesso.');
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error && requestError.message ? requestError.message : 'Não foi possível salvar o cadastro. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  if (tenantLoading || loading) return <div aria-label="Carregando clientes" className="grid gap-4"><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div>;
  if (!atelierId || !membershipValid) return <EmptyState title="Ateliê indisponível" description="Entre com uma conta vinculada a um ateliê ativo para consultar clientes." icon={<UsersRound size={20} />} />;
  if (!canRead) return <EmptyState title="Acesso restrito" description="Seu perfil não tem permissão para consultar os clientes deste ateliê." icon={<UsersRound size={20} />} />;

  return <section className="grid gap-5">
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="relative"><Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><Input aria-label="Buscar clientes" className="pl-10" maxLength={64} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou e-mail" value={search} /></div>
      <div className="flex gap-2"><Button onClick={() => void load()} variant="secondary"><RefreshCw size={16} />Atualizar</Button>{canWrite ? <Button onClick={openCreateForm}><Plus size={16} />Novo cliente</Button> : null}</div>
    </div>

    {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{notice}</p> : null}
    {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert"><p>{error}</p><Button className="mt-3" onClick={() => void load()} variant="secondary">Tentar novamente</Button></div> : null}

    <Card><CardHeader><CardTitle className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><UsersRound className="text-violet-700" size={19} />Clientes</span><Badge tone="violet">{countLabel}</Badge></CardTitle></CardHeader><CardContent>
      {clients.length === 0 && !error ? <EmptyState description={search ? 'Tente outro nome ou início de e-mail.' : 'Cadastre o primeiro cliente ou aguarde uma proposta aprovada vincular um cliente autenticado.'} icon={<UsersRound size={21} />} title={search ? 'Nenhum cliente encontrado' : 'Sua lista de clientes está vazia'} /> : null}
      {clients.length > 0 ? <div className="divide-y divide-slate-100">{clients.map((client) => <article className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" key={client.id}>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-semibold text-slate-950">{client.name}</h2>{client.hasLinkedAccount ? <Badge tone="green">Conta vinculada</Badge> : <Badge tone="neutral">Cadastro manual</Badge>}</div><p className="mt-1 truncate text-sm text-slate-600">{client.email}{client.phone ? ` · ${client.phone}` : ''}</p></div>
        <div className="flex shrink-0 gap-2"><Button onClick={() => openEditForm(client)} variant="secondary" disabled={!canWrite}>Editar</Button><Link aria-label={`Abrir ficha de ${client.name}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-200 px-3 text-sm font-semibold text-violet-800 hover:bg-violet-50" href={`/atelier/clientes/${encodeURIComponent(client.id)}`}>Abrir ficha<ArrowRight size={15} /></Link></div>
      </article>)}</div> : null}
      {nextCursor ? <div className="mt-5 flex justify-center"><Button disabled={loadingMore} onClick={() => void load(nextCursor, true)} variant="secondary">{loadingMore ? 'Carregando…' : 'Carregar mais clientes'}</Button></div> : null}
    </CardContent></Card>

    {formOpen ? <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 sm:place-items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}>
      <section aria-labelledby="client-form-title" aria-modal="true" className="w-full max-w-xl rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7" role="dialog">
        <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-950" id="client-form-title">{editingClient ? 'Editar cliente' : 'Novo cliente'}</h2><p className="mt-1 text-sm text-slate-600">Guarde somente os dados necessários para atender esta pessoa.</p></div><button aria-label="Fechar formulário" className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" disabled={saving} onClick={() => setFormOpen(false)} type="button"><X size={18} /></button></div>
        <form className="grid gap-4" onSubmit={(event) => void submitClient(event)}>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Nome<input autoComplete="name" className="min-h-11 rounded-xl border border-slate-300 px-3" maxLength={120} onChange={(event) => setName(event.target.value)} required value={name} /></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">E-mail<input autoComplete="email" className="min-h-11 rounded-xl border border-slate-300 px-3" maxLength={254} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Telefone <span className="font-normal text-slate-500">(opcional)</span><input autoComplete="tel" className="min-h-11 rounded-xl border border-slate-300 px-3" maxLength={32} onChange={(event) => setPhone(event.target.value)} type="tel" value={phone} /></label>
          {editingClient?.hasLinkedAccount ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Este cliente tem uma conta vinculada. O e-mail só pode mudar depois que a pessoa confirmar o novo endereço.</p> : null}
          <div className="flex flex-col-reverse justify-end gap-2 pt-1 sm:flex-row"><Button disabled={saving} onClick={() => setFormOpen(false)} type="button" variant="secondary">Cancelar</Button><Button disabled={saving} type="submit">{saving ? 'Salvando…' : editingClient ? 'Salvar alterações' : 'Cadastrar cliente'}</Button></div>
        </form>
      </section>
    </div> : null}
  </section>;
}
