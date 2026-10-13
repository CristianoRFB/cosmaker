'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionPicker } from '@/components/team/permission-picker';
import { teamRoleLabel } from '@/lib/team/presentation';
import { teamMemberUpdateSchema } from '@/schemas/team.schema';
import { listAtelierTeam, transferAtelierOwnership, updateAtelierMember } from '@/repositories/team.repository';
import { useAuth } from '@/providers/auth-provider';
import { useTenant } from '@/providers/tenant-provider';
import type { AssignableTeamRole, TeamMemberRecord } from '@/types/team';

function formatDate(value: string | null) {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data não informada'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
}

export function TeamWorkspace({ focus = 'team' }: { focus?: 'team' | 'permissions' }) {
  const { firebaseUser, refreshUser } = useAuth();
  const { atelierId, role: actorRole, permissions: actorPermissions, membershipValid, loading: tenantLoading, hasPermission } = useTenant();
  const canRead = hasPermission('team:read');
  const canManage = hasPermission('team:manage');
  const [members, setMembers] = useState<TeamMemberRecord[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<AssignableTeamRole>('assistant');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedActive, setSelectedActive] = useState(true);
  const [transferTarget, setTransferTarget] = useState<TeamMemberRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAtelierTeam();
      setMembers(result.members);
      setOwnerId(result.ownerId);
      setNextCursor(result.nextCursor);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar a equipe.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tenantLoading) return;
    if (!atelierId || !membershipValid || !canRead) { setLoading(false); return; }
    void load();
  }, [atelierId, canRead, load, membershipValid, tenantLoading]);

  async function loadMore() {
    if (!nextCursor || busy) return;
    setBusy(true); setError('');
    try {
      const result = await listAtelierTeam(nextCursor);
      setMembers((current) => [...current, ...result.members]);
      setNextCursor(result.nextCursor);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar mais membros.');
    } finally { setBusy(false); }
  }

  function canEdit(member: TeamMemberRecord) {
    if (!canManage || member.id === firebaseUser?.uid || member.role === 'owner') return false;
    if (member.role === 'admin' && actorRole !== 'owner') return false;
    if (actorRole !== 'owner' && actorRole !== 'admin'
      && member.permissions.some((permission) => !actorPermissions.includes(permission))) return false;
    return true;
  }

  function edit(member: TeamMemberRecord) {
    setEditingId(member.id);
    setSelectedRole(member.role as AssignableTeamRole);
    setSelectedPermissions([...member.permissions]);
    setSelectedActive(member.active);
    setNotice(''); setError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setError(''); setNotice('');
    const parsed = teamMemberUpdateSchema.safeParse({
      memberId: editingId, role: selectedRole,
      permissions: selectedRole === 'admin' ? [] : selectedPermissions,
      active: selectedActive,
    });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Revise o papel e as permissões.'); return; }
    setBusy(true);
    try {
      await updateAtelierMember(parsed.data);
      setEditingId(null);
      setNotice('Vínculo e permissões atualizados.');
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível atualizar o membro.');
    } finally { setBusy(false); }
  }

  async function transfer() {
    if (!transferTarget) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await transferAtelierOwnership(transferTarget.id);
      setTransferTarget(null);
      await refreshUser();
      await load();
      setNotice('Titularidade transferida. Sua conta agora é administradora.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível transferir a titularidade.');
    } finally { setBusy(false); }
  }

  if (tenantLoading || loading) return <div aria-label="Carregando equipe" className="grid gap-4"><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;
  if (!atelierId || !membershipValid) return <Feedback title="Ateliê indisponível" description="Entre com uma conta vinculada a um ateliê ativo para consultar a equipe." />;
  if (!canRead) return <Feedback title="Acesso restrito" description="Seu perfil não tem permissão para consultar a equipe." />;

  const current = members.find((member) => member.id === editingId);
  const grantable = actorRole === 'owner' || actorRole === 'admin' ? null : actorPermissions;
  return <section className="grid gap-5">
    <Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div><div className="flex items-center gap-2"><UsersRound className="text-violet-700" size={20} /><h2 className="font-semibold text-slate-950">{focus === 'permissions' ? 'Acessos da equipe' : 'Membros do ateliê'}</h2></div><p className="mt-2 text-sm leading-6 text-slate-600">Papéis e permissões são aplicados no servidor e nas regras dos dados. Mudanças de acesso aparecem na sessão do membro.</p></div>
      <div className="flex flex-wrap gap-2">
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-800" href="/atelier/equipe/convites">Convites <ArrowRight size={15} /></Link>
        {focus !== 'permissions' ? <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-800" href="/atelier/configuracoes/permissoes">Permissões <ShieldCheck size={15} /></Link> : null}
      </div>
    </CardContent></Card>
    {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{notice}</p> : null}
    {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" role="alert">{error}</p> : null}
    <div className="grid gap-3">
      {members.map((member) => <Card key={member.id}><CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{member.name}</h3><Badge tone={member.active ? 'green' : 'red'}>{member.active ? 'Ativo' : 'Inativo'}</Badge>{member.id === ownerId ? <Badge tone="violet">Titular atual</Badge> : null}</div><p className="mt-1 break-all text-sm text-slate-600">{member.email}</p><p className="mt-2 text-xs text-slate-500">{teamRoleLabel[member.role] ?? member.role} · {member.permissions.length} permissões específicas · desde {formatDate(member.joinedAt)}</p></div>
        <div className="flex flex-wrap gap-2">
          {canEdit(member) ? <Button onClick={() => edit(member)} variant="secondary">Alterar acesso</Button> : null}
          {actorRole === 'owner' && member.active && member.id !== firebaseUser?.uid
            ? <Button onClick={() => setTransferTarget(member)} variant="secondary">Transferir titularidade</Button> : null}
        </div>
      </CardContent></Card>)}
      {!members.length ? <Feedback title="Nenhum membro encontrado" description="Os membros aceitos para este ateliê aparecerão aqui." /> : null}
      {nextCursor ? <Button className="w-fit" disabled={busy} onClick={() => void loadMore()} variant="secondary">{busy ? 'Carregando…' : 'Carregar mais membros'}</Button> : null}
    </div>
    {current ? <Card><CardHeader><CardTitle>Alterar acesso de {current.name}</CardTitle><p className="text-sm text-slate-600">A desativação remove o acesso ao ateliê e preserva o histórico do membro.</p></CardHeader><CardContent><form className="grid gap-5" onSubmit={(event) => void save(event)}>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Papel<select className="min-h-11 rounded-xl border border-slate-300 px-3" onChange={(event) => setSelectedRole(event.target.value as AssignableTeamRole)} value={selectedRole}>
        {actorRole === 'owner' ? <option value="admin">Administrador</option> : null}
        <option value="cosmaker">Cosmaker</option><option value="assistant">Assistente</option><option value="finance">Financeiro</option>
      </select></label>
      {selectedRole === 'admin' ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">O papel Administrador já concede todos os acessos operacionais do ateliê.</p>
        : <PermissionPicker allowed={grantable} onChange={setSelectedPermissions} value={selectedPermissions} />}
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input checked={selectedActive} className="accent-violet-700" onChange={(event) => setSelectedActive(event.target.checked)} type="checkbox" />Vínculo ativo</label>
      <div className="flex flex-wrap gap-2"><Button disabled={busy} type="submit">{busy ? 'Salvando…' : 'Salvar acesso'}</Button><Button disabled={busy} onClick={() => setEditingId(null)} variant="secondary">Cancelar</Button></div>
    </form></CardContent></Card> : null}
    <ConfirmDialog
      confirmDisabled={busy}
      confirmLabel="Transferir titularidade"
      description={`A titularidade passará para ${transferTarget?.name ?? 'este membro'}. Sua conta continuará ativa como Administrador. Esta mudança será registrada na auditoria.`}
      onClose={() => setTransferTarget(null)}
      onConfirm={() => void transfer()}
      open={transferTarget !== null}
      title="Confirmar transferência"
    />
  </section>;
}

function Feedback({ title, description }: { title: string; description: string }) {
  return <Card><CardContent className="p-5"><h2 className="font-semibold text-slate-950">{title}</h2><p className="mt-2 text-sm text-slate-600">{description}</p></CardContent></Card>;
}
