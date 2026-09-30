'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import { loginSchema, passwordResetSchema, registrationSchema } from '@/schemas/auth.schema';
import { loginWithEmail, loginWithGoogle, registerWithEmail, requestPasswordReset } from '@/services/firebase/auth.service';
import { useAuth } from '@/providers/auth-provider';
import { firebaseConfigured } from '@/services/firebase/firebase.client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Mode = 'login' | 'register' | 'reset';

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const title = mode === 'login' ? 'Entre na sua conta' : mode === 'register' ? 'Crie sua conta' : 'Recupere sua senha';
  const description = mode === 'login'
    ? 'Acompanhe seus projetos e converse com seu ateliê.'
    : mode === 'register'
      ? 'Comece a acompanhar seus projetos em um só lugar.'
      : 'Enviaremos um link para redefinir sua senha.';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setFieldErrors({});
    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries());
    const schema = mode === 'login' ? loginSchema : mode === 'register' ? registrationSchema : passwordResetSchema;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) nextErrors[String(issue.path[0] ?? 'form')] = issue.message;
      setFieldErrors(nextErrors);
      return;
    }
    setPending(true);
    try {
      if (mode === 'register') {
        const data = parsed.data as { name: string; email: string; password: string };
        await registerWithEmail(data.name, data.email, data.password);
        setSuccess('Conta criada. Confira sua caixa de entrada para verificar seu e-mail.');
        router.push('/verificar-email');
      } else if (mode === 'login') {
        const data = parsed.data as { email: string; password: string };
        await loginWithEmail(data.email, data.password);
        await refreshUser();
        const requestedPath = new URLSearchParams(window.location.search).get('next');
        const safePath = requestedPath?.startsWith('/') && !requestedPath.startsWith('//') && !requestedPath.includes('\\') ? requestedPath : '/cliente';
        router.push(safePath);
      } else {
        const data = parsed.data as { email: string };
        await requestPasswordReset(data.email);
        setSuccess('Se este endereço estiver cadastrado, você receberá um link para redefinir sua senha.');
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível concluir. Tente novamente.');
    } finally {
      setPending(false);
    }
  }

  async function googleLogin() {
    setError('');
    setPending(true);
    try {
      await loginWithGoogle();
      await refreshUser();
      router.push('/cliente');
    } catch (googleError) {
      setError(googleError instanceof Error ? googleError.message : 'Não foi possível entrar com o Google.');
    } finally {
      setPending(false);
    }
  }

  return <Card className="overflow-hidden border-white/80 bg-white/95 shadow-[0_28px_80px_-42px_rgba(84,50,160,0.45)] backdrop-blur">
    <div aria-hidden="true" className="h-1.5 bg-gradient-to-r from-violet-700 via-fuchsia-500 to-pink-400" />
    <CardHeader className="pb-3 pt-7 sm:px-7"><div className="mb-3 grid size-11 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles size={20} /></div><CardTitle className="text-2xl">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
    <CardContent className="sm:px-7">
      {!firebaseConfigured ? <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">O Firebase ainda não está conectado neste ambiente. As credenciais precisam ser configuradas antes de entrar.</div> : null}
      <form className="grid gap-4" noValidate onSubmit={submit}>
        {mode === 'register' ? <Field label="Seu nome" name="name" error={fieldErrors.name} autoComplete="name" placeholder="Como podemos chamar você?" /> : null}
        <Field label="E-mail" name="email" error={fieldErrors.email} autoComplete="email" type="email" placeholder="voce@exemplo.com" icon={<Mail size={16} />} />
        {mode !== 'reset' ? <div><label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="password">Senha</label><div className="relative"><Input autoComplete={mode === 'register' ? 'new-password' : 'current-password'} className="pr-12" id="password" minLength={mode === 'register' ? 8 : undefined} name="password" placeholder={mode === 'register' ? 'Pelo menos 8 caracteres' : 'Sua senha'} type={showPassword ? 'text' : 'password'} /> <button aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700" onClick={() => setShowPassword(!showPassword)} type="button">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{fieldErrors.password ? <p className="mt-1 text-xs text-rose-700">{fieldErrors.password}</p> : null}</div> : null}
        {mode === 'register' ? <Field label="Confirme sua senha" name="confirmPassword" error={fieldErrors.confirmPassword} autoComplete="new-password" type="password" placeholder="Digite a senha novamente" /> : null}
        {error ? <p className="rounded-lg bg-rose-50 px-3.5 py-3 text-sm text-rose-800" role="alert">{error}</p> : null}
        {success ? <p className="rounded-lg bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800" role="status">{success}</p> : null}
        <Button className="mt-1 w-full" disabled={pending || !firebaseConfigured} type="submit">{pending ? 'Aguarde…' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : 'Enviar link de recuperação'}{!pending ? <ArrowRight aria-hidden="true" size={16} /> : null}</Button>
      </form>
      {mode === 'login' ? <><div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />ou continue com<span className="h-px flex-1 bg-slate-200" /></div><Button className="w-full" disabled={pending || !firebaseConfigured} onClick={googleLogin} variant="secondary"><GoogleMark />Google</Button></> : null}
      <div className="mt-6 grid gap-3 text-center text-sm text-slate-600">
        {mode === 'login' ? <><Link className="font-semibold text-violet-700 hover:text-violet-900" href="/recuperar-senha">Esqueci minha senha</Link><p>Ainda não tem conta? <Link className="font-semibold text-violet-700" href="/cadastro">Criar conta</Link></p></> : mode === 'register' ? <p>Já tem conta? <Link className="font-semibold text-violet-700" href="/login">Entrar</Link></p> : <Link className="inline-flex items-center justify-center gap-2 font-semibold text-violet-700" href="/login"><ArrowLeft size={15} />Voltar para entrar</Link>}
      </div>
      <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs leading-5 text-slate-400"><LockKeyhole size={13} /> Seus dados de acesso são protegidos pelo Firebase Authentication.</p>
    </CardContent>
  </Card>;
}

function Field({ label, name, error, icon, ...props }: { label: string; name: string; error?: string; icon?: ReactNode; type?: string; autoComplete?: string; placeholder?: string }) {
  return <div><label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor={name}>{label}</label><div className="relative">{icon ? <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span> : null}<Input className={icon ? 'pl-10' : ''} id={name} name={name} {...props} /></div>{error ? <p className="mt-1 text-xs text-rose-700">{error}</p> : null}</div>;
}

function GoogleMark() { return <span aria-hidden="true" className="grid size-5 place-items-center rounded-full border border-slate-200 text-xs font-bold text-blue-600">G</span>; }
