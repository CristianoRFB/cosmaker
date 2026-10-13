'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ClipboardCopy, MailPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionPicker } from '@/components/team/permission-picker';
import { teamRoleLabel } from '@/lib/team/presentation';
import { teamInvitationSchema } from '@/schemas/team.schema';
import { createAtelierInvitation, listAtelierInvitations, revokeAtelierInvitation } from '@/repositories/team.repository';
import { useTenant } from '@/providers/tenant-provider';
import type { AssignableTeamRole, TeamInvitationRecord } from '@/types/team';

function formatDate(value: string | null) {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data não informada'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function TeamInvitationsPage() {
  const { atelierId, role: actorRole, permissions: actorPermissions, membershipValid, loading: tenantLoading, hasPermission } = useTenant();
  const canRead = hasPermission('team:read');
  const canManage = hasPermission('team:manage');
  const [invitations, setInvitations] = useState<TeamInvitationRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableTeamRole>('assistant');
  const [permissions, setPermissions] = useState<string[]>(['team:read']);
  const [latestLink, setLatestLink] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAtelierInvitations();
      setInvitations(result.invitations);
      setNextCursor(result.nextCursor);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os convites.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tenantLoading) return;
    if (!atelierId || !membershipValid || !canRead) { setLoading(false); return; }
    void load();
  }, [atelierId, canRead, load, membershipValid, tenantLoading]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setNotice(''); setLatestLink('');
    const parsed = teamInvitationSchema.safeParse({
      email, role, permissions: role === 'admin' ? [] : permissions,
    });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Revise o convite.'); return; }
    setBusy(true);
    try {
      const created = await createAtelierInvitation(parsed.data);
      const url = new URL('/convite', window.location.origin);
      url.searchParams.set('atelierId', created.atelierId);
      url.searchParams.set('invitationId', created.invitationId);
      url.searchParams.set('token', created.token);
      setLatestLink(url.toString());
      setEmail('');
      setNotice('Convite criado. Copie o link agora; ele será mostrado somente nesta criação.');
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível criar o convite.');
    } finally { setBusy(false); }
  }

  async function revoke(invitationId: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      await revokeAtelierInvitation(invitationId);
      setNotice('Convite revogado.');
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível revogar o convite.');
    } finally { setBusy(false); }
  }

  async function loadMore() {
    if (!nextCursor || busy) return;
    setBusy(true); setError('');
    try {
      const result = await listAtelierInvitations(nextCursor);
      setInvitations((current) => [...current, ...result.invitations]);
      setNextCursor(result.nextCursor);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar mais convites.');
    } finally { setBusy(false); }
  }

  if (tenantLoading || loading) return <div aria-label="Carregando convites" className="grid gap-4"><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;
  if (!atelierId || !membershipValid) return <Feedback title="Ateliê indisponível" description="Entre com uma conta vinculada a um ateliê ativo." />;
  if (!canRead) return <Feedback title="Acesso restrito" description="Seu perfil não tem permissão para consultar convites." />;

  return <section className="grid gap-5">
    <Link className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-violet-800" href="/atelier/equipe"><ArrowLeft size={16} />Voltar à equipe</Link>
    {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{notice}</p> : null}
    {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" role="alert">{error}</p> : null}
    {canManage ? <Card><CardHeader><CardTitle className="flex items-center gap-2"><MailPlus size={19} />Convidar para a equipe</CardTitle><p className="text-sm leading-6 text-slate-600">O convite vence em sete dias e só pode ser aceito por uma conta com este e-mail verificado. Nenhuma mensagem é enviada automaticamente.</p></CardHeader><CardContent>
      <form className="grid gap-5" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">E-mail da pessoa<Input autoComplete="email" maxLength={254} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Papel<select className="min-h-11 rounded-xl border border-slate-300 px-3" onChange={(event) => setRole(event.target.value as AssignableTeamRole)} value={role}>
            {actorRole === 'owner' ? <option value="admin">Administrador</option> : null}
            <option value="cosmaker">Cosmaker</option><option value="assistant">Assistente</option><option value="finance">Financeiro</option>
          </select></label>
        </div>
        {role === 'admin' ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Administrador tem acesso operacional completo. Apenas o titular pode conceder esse papel.</p>
          : <PermissionPicker allowed={actorRole === 'owner' || actorRole === 'admin' ? null : actorPermissions} onChange={setPermissions} value={permissions} />}
        <Button className="w-fit" disabled={busy} type="submit">{busy ? 'Criando…' : 'Criar convite'}</Button>
      </form>
      {latestLink ? <div className="mt-5 grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">Link de aceite — exibido uma vez</p><Input aria-label="Link do convite" readOnly value={latestLink} /><Button className="w-fit" onClick={() => void navigator.clipboard.writeText(latestLink).then(() => setNotice('Link copiado. Compartilhe somente com a pessoa convidada.')).catch(() => setError('Não foi possível copiar automaticamente. Selecione o link acima para copiar.'))} variant="secondary"><ClipboardCopy size={15} />Copiar link</Button></div> : null}
    </CardContent></Card> : null}
    <Card><CardHeader><CardTitle>Histórico de convites</CardTitle></CardHeader><CardContent className="grid gap-3">
      {invitations.map((invitation) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4" key={invitation.id}>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="break-all font-semibold text-slate-900">{invitation.email}</p><Badge tone={invitation.status === 'accepted' ? 'green' : invitation.status === 'pending' ? 'amber' : 'neutral'}>{invitation.status === 'pending' ? 'Pendente' : invitation.status === 'accepted' ? 'Aceito' : invitation.status === 'revoked' ? 'Revogado' : 'Expirado'}</Badge></div><p className="mt-1 text-xs text-slate-500">{teamRoleLabel[invitation.role]} · criado em {formatDate(invitation.createdAt)} · vence em {formatDate(invitation.expiresAt)}</p></div>
        {canManage && invitation.status === 'pending' ? <Button disabled={busy} onClick={() => void revoke(invitation.id)} variant="danger">Revogar</Button> : null}
      </div>)}
      {!invitations.length ? <p className="text-sm text-slate-600">Nenhum convite registrado.</p> : null}
      {nextCursor ? <Button className="w-fit" disabled={busy} onClick={() => void loadMore()} variant="secondary">{busy ? 'Carregando…' : 'Carregar mais convites'}</Button> : null}
    </CardContent></Card>
  </section>;
}

function Feedback({ title, description }: { title: string; description: string }) {
  return <Card><CardContent className="p-5"><h2 className="font-semibold text-slate-950">{title}</h2><p className="mt-2 text-sm text-slate-600">{description}</p></CardContent></Card>;
}
