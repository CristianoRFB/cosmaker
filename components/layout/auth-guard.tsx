'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { useTenant } from '@/providers/tenant-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { accountHome } from '@/lib/navigation/workspace';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export type Audience = 'client' | 'atelier' | 'admin';

export function AuthGuard({ audience, children }: { audience: Audience; children: ReactNode }) {
  const { firebaseEnabled, loading, user, profileError, refreshUser } = useAuth();
  const { loading: tenantLoading, membershipValid } = useTenant();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && firebaseEnabled && !user && !profileError) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, firebaseEnabled, user, profileError, pathname, router]);

  if (!firebaseEnabled) return <Card className="mx-auto my-12 max-w-xl"><CardHeader><CardTitle>Conexão ainda não configurada</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-slate-600">Esta área exige uma sessão autenticada. Configure o Firebase no ambiente para continuar.</p><Link className="mt-5 inline-flex font-semibold text-violet-700" href="/">Voltar ao início</Link></CardContent></Card>;
  if (loading || (audience === 'atelier' && tenantLoading)) return <div role="status" aria-live="polite" aria-label="Carregando área protegida" className="mx-auto grid max-w-5xl gap-4 p-6"><p className="text-sm text-slate-600">Carregando sua área…</p><Skeleton className="h-12 w-56" /><Skeleton className="h-56 w-full" /></div>;
  if (profileError) return <Card role="alert" className="mx-auto my-12 max-w-xl"><CardHeader><CardTitle>Não foi possível abrir sua conta</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-600">{profileError}</p><Button className="mt-4" onClick={() => void refreshUser()}>Tentar novamente</Button></CardContent></Card>;
  if (!user) return null;

  const allowed = audience === 'client'
    ? user.accountType === 'client'
    : audience === 'atelier'
      ? user.accountType === 'atelier_member' && Boolean(user.atelierId) && membershipValid
      : user.accountType === 'platform_admin' && user.active;

  const ownArea = accountHome(user.accountType);
  const ownAreaUnavailable = ownArea === ({ client: '/cliente', atelier: '/atelier', admin: '/admin' }[audience]);

  if (!allowed) return <Card className="mx-auto my-12 max-w-xl"><CardHeader><CardTitle>{audience === 'atelier' && user.accountType === 'atelier_member' ? 'Ateliê não vinculado' : 'Acesso não permitido'}</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-slate-600">Esta área não está disponível para sua conta. Volte à sua área para continuar; se você esperava ter acesso, fale com o responsável pelo ateliê ou pela plataforma.</p><Link className="mt-5 inline-flex font-semibold text-violet-700" href={ownAreaUnavailable ? '/' : ownArea}>{ownAreaUnavailable ? 'Voltar ao início' : 'Ir para minha área'}</Link></CardContent></Card>;
  return <>{children}</>;
}
