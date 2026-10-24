'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { listPlatformUsers, type PlatformUser } from '@/repositories/admin.repository';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const accountLabels: Record<string, string> = { client: 'Cliente', atelier_member: 'Equipe do ateliê', platform_admin: 'Administração da plataforma', unknown: 'Cadastro legado' };
const authLabels: Record<string, string> = { enabled: 'Conta de autenticação habilitada', disabled: 'Conta de autenticação desabilitada', missing: 'Conta de autenticação ausente' };
function UserDirectory({ uid }: { uid: string }) {
  const [state, setState] = useState<{ uid: string; users: PlatformUser[]; nextCursor: string | null }>({ uid: '', users: [], nextCursor: null });
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const revision = useRef(0);
  const invalidate = useCallback(() => { revision.current++; }, []);
  const load = useCallback(async (cursor?: string) => {
    const request = ++revision.current; const owner = uid;
    setLoading(true); setError(''); if (!cursor) setState({ uid: '', users: [], nextCursor: null });
    try { const page = await listPlatformUsers(cursor); if (revision.current === request) setState(previous => ({ uid: owner, users: cursor && previous.uid === owner ? [...previous.users, ...page.users] : page.users, nextCursor: page.nextCursor })); }
    catch (reason) { if (revision.current === request) setError(reason instanceof Error ? reason.message : 'Não foi possível consultar os perfis.'); }
    finally { if (revision.current === request) setLoading(false); }
  }, [uid]);
  useEffect(() => { void load(); return invalidate; }, [load, invalidate]);
  const page = state.uid === uid ? state : { users: [], nextCursor: null };
  return <section className="grid gap-5"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Perfis de acesso</h1><Button variant="secondary" disabled={loading} onClick={() => void load()}>Atualizar perfis</Button></div><p className="text-sm leading-6 text-slate-600">Perfis cadastrados no Cosmaker e sua situação na autenticação. A equipe e os convites são mantidos nos fluxos do respectivo ateliê.</p>
    {error ? <Card role="alert" className="border-rose-200 p-5 text-sm text-rose-800">{error}</Card> : null}
    {loading ? <p role="status">Carregando perfis…</p> : null}
    {!loading && !error && !page.users.length ? <Card className="p-5">Nenhum perfil cadastrado.</Card> : null}
    <ul className="grid gap-3">{page.users.map(user => <li key={user.id}><Card className="grid min-w-0 gap-3 p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="break-words font-semibold">{user.name || 'Perfil sem nome'}</h2><span className="text-sm">{user.active ? 'Perfil ativo' : 'Perfil desativado'}</span></div><p className="break-all text-sm text-slate-600">{user.email || 'E-mail não cadastrado'}</p><p className="text-sm">{accountLabels[user.accountType]}{user.role ? ` · ${user.role}` : ''}</p><p className="text-sm text-slate-600">{authLabels[user.authStatus]}{user.emailVerified === null ? '' : user.emailVerified ? ' · e-mail verificado' : ' · e-mail não verificado'}</p><p className="break-all text-xs text-slate-500">Identificador: {user.id}</p>{user.atelierId ? <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-violet-700 underline" href={`/admin/atelies/${encodeURIComponent(user.atelierId)}`}>Abrir ateliê vinculado</Link> : null}</Card></li>)}</ul>
    {page.nextCursor ? <Button variant="secondary" disabled={loading} onClick={() => void load(page.nextCursor!)}>Carregar mais perfis</Button> : null}
  </section>;
}

export default function Usuários() { const { firebaseUser } = useAuth(); const uid = firebaseUser?.uid || ''; return <UserDirectory key={uid} uid={uid} />; }
