'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { acceptAtelierInvitation } from '@/repositories/team.repository';
import { checkEmailVerification } from '@/services/firebase/auth.service';
import { useAuth } from '@/providers/auth-provider';

type InvitationLink = { atelierId: string; invitationId: string; token: string; returnPath: string };

export default function AcceptInvitationPage() {
  const router = useRouter();
  const { firebaseUser, loading: authLoading, refreshUser } = useAuth();
  const [invitation, setInvitation] = useState<InvitationLink | null>(null);
  const [linkReady, setLinkReady] = useState(false);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const atelierId = params.get('atelierId');
    const invitationId = params.get('invitationId');
    const token = params.get('token');
    if (atelierId && invitationId && token) {
      setInvitation({ atelierId, invitationId, token, returnPath: `${window.location.pathname}${window.location.search}` });
    }
    setLinkReady(true);
  }, []);
  useEffect(() => setVerified(firebaseUser?.emailVerified === true), [firebaseUser]);

  async function refreshVerification() {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await checkEmailVerification();
      setVerified(result);
      setNotice(result ? 'E-mail confirmado. Agora você pode aceitar o convite.' : 'A confirmação ainda não apareceu. Verifique sua caixa de entrada.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível conferir o e-mail.');
    } finally { setBusy(false); }
  }

  async function accept() {
    if (!invitation || !firebaseUser) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await firebaseUser.getIdToken(true);
      await acceptAtelierInvitation({
        atelierId: invitation.atelierId,
        invitationId: invitation.invitationId,
        token: invitation.token,
      });
      await refreshUser();
      router.replace('/atelier/equipe');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Este convite não está disponível para esta conta.');
    } finally { setBusy(false); }
  }

  if (!linkReady || authLoading) return <div aria-label="Carregando convite" className="grid gap-3"><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>;
  return <Card className="overflow-hidden border-white/80 bg-white/95 shadow-[0_28px_80px_-42px_rgba(84,50,160,0.45)]"><div className="h-1.5 bg-gradient-to-r from-violet-700 via-fuchsia-500 to-pink-400" /><CardHeader className="pt-7 sm:px-7"><span className="grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-700"><UsersRound size={23} /></span><CardTitle className="mt-3 text-2xl">Convite para equipe</CardTitle><CardDescription>Entre com o e-mail verificado que recebeu o convite. O vínculo será criado somente após seu aceite.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:px-7">
    {!invitation ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">O link do convite está incompleto. Solicite um novo link ao ateliê.</p> : null}
    {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900" role="alert">{error}</p> : null}
    {notice ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{notice}</p> : null}
    {invitation && !firebaseUser ? <div className="grid gap-3"><Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white" href={`/login?next=${encodeURIComponent(invitation.returnPath)}`}>Entrar na minha conta</Link><Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-200 px-4 text-sm font-semibold text-violet-800" href={`/cadastro?next=${encodeURIComponent(invitation.returnPath)}`}>Criar conta</Link></div> : null}
    {invitation && firebaseUser && !verified ? <div className="grid gap-3"><p className="text-sm text-slate-700">Confirme o e-mail <strong>{firebaseUser.email}</strong> antes de aceitar.</p><Button disabled={busy} onClick={() => void refreshVerification()} variant="secondary"><BadgeCheck size={16} />Já confirmei meu e-mail</Button><Link className="text-sm font-semibold text-violet-700" href={`/verificar-email?next=${encodeURIComponent(invitation.returnPath)}`}>Abrir instruções de verificação</Link></div> : null}
    {invitation && firebaseUser && verified ? <div className="grid gap-3"><p className="text-sm text-slate-700">Conta: <strong>{firebaseUser.email}</strong>. O convite só será aceito se o endereço corresponder exatamente ao cadastrado pelo ateliê.</p><Button disabled={busy} onClick={() => void accept()}>{busy ? 'Validando convite…' : 'Aceitar convite'}</Button><p className="text-xs leading-5 text-slate-500">O link expira em sete dias, pode ser usado uma vez e não dá acesso a outro ateliê.</p></div> : null}
  </CardContent></Card>;
}
