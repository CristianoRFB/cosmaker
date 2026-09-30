'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/providers/auth-provider';
import { checkEmailVerification, resendVerificationEmail } from '@/services/firebase/auth.service';

export default function VerifyEmailPage() {
  const { firebaseUser, firebaseEnabled } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function checkStatus() {
    setPending(true); setMessage(''); setError('');
    try {
      if (await checkEmailVerification()) { setMessage('E-mail confirmado. Você já pode acessar sua conta.'); router.push('/cliente'); }
      else setMessage('Ainda não encontramos a confirmação. Abra o link que enviamos e tente novamente.');
    } catch (verifyError) { setError(verifyError instanceof Error ? verifyError.message : 'Não foi possível conferir agora.'); }
    finally { setPending(false); }
  }

  async function resend() {
    setPending(true); setMessage(''); setError('');
    try { await resendVerificationEmail(); setMessage('Enviamos outro link de verificação.'); }
    catch (resendError) { setError(resendError instanceof Error ? resendError.message : 'Não foi possível reenviar.'); }
    finally { setPending(false); }
  }

  return <Card className="overflow-hidden border-white/80 bg-white/95 shadow-[0_28px_80px_-42px_rgba(84,50,160,0.45)]"><div className="h-1.5 bg-gradient-to-r from-violet-700 via-fuchsia-500 to-pink-400" /><CardHeader className="items-center pt-8 text-center"><span className="grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-700"><MailCheck size={26} /></span><CardTitle className="mt-2 text-2xl">Confirme seu e-mail</CardTitle><CardDescription>Enviamos um link para {firebaseUser?.email ? <strong className="text-slate-800">{firebaseUser.email}</strong> : 'o endereço informado'}. Confirme para manter sua conta protegida.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:px-7">
    {!firebaseEnabled ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">O Firebase ainda não está conectado neste ambiente.</p> : null}
    {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{message}</p> : null}
    {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p> : null}
    <Button disabled={pending || !firebaseEnabled} onClick={checkStatus}><BadgeCheck size={17} />Já confirmei</Button>
    <Button disabled={pending || !firebaseEnabled || !firebaseUser} onClick={resend} variant="secondary">Reenviar link</Button>
    <Link className="mt-2 text-center text-sm font-semibold text-violet-700" href="/login">Voltar para entrar</Link>
  </CardContent></Card>;
}
