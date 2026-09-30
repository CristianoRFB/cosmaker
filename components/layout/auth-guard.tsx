'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { useTenant } from '@/providers/tenant-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export type Audience = 'client' | 'atelier' | 'admin';

export function AuthGuard({ audience, children }: { audience: Audience; children: ReactNode }) {
  const { firebaseEnabled, loading, user, profileError } = useAuth();
  const { loading: tenantLoading, membershipValid } = useTenant();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && firebaseEnabled && !user && !profileError) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, firebaseEnabled, user, profileError, pathname, router]);

  if (!firebaseEnabled) return <Card className="mx-auto my-12 max-w-xl"><CardHeader><CardTitle>Conexão ainda não configurada</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-slate-600">Esta área exige uma sessão autenticada. Configure o Firebase no ambiente para continuar.</p><Link className="mt-5 inline-flex font-semibold text-violet-700" href="/">Voltar ao início</Link></CardContent></Card>;
  if (loading || (audience === 'atelier' && tenantLoading)) return <div aria-label="Carregando área protegida" className="mx-auto grid max-w-5xl gap-4 p-6"><Skeleton className="h-12 w-56" /><Skeleton className="h-56 w-full" /></div>;
  if (profileError) return <Card className="mx-auto my-12 max-w-xl"><CardHeader><CardTitle>Não foi possível abrir sua conta</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-600">{profileError}</p></CardContent></Card>;
  if (!user) return null;

  const allowed = audience === 'client'
    ? user.accountType === 'client'
    : audience === 'atelier'
      ? user.accountType === 'atelier_member' && Boolean(user.atelierId) && membershipValid
      : user.accountType === 'platform_admin';

  if (!allowed) return <Card className="mx-auto my-12 max-w-xl"><CardHeader><CardTitle>{audience === 'atelier' && user.accountType === 'atelier_member' ? 'Ateliê não vinculado' : 'Acesso não permitido'}</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-slate-600">Sua conta não tem vínculo e permissões para esta área. A autorização dos dados também é aplicada pelas regras do Firebase.</p><Link className="mt-5 inline-flex font-semibold text-violet-700" href={user.accountType === 'client' ? '/cliente' : '/'}>Ir para minha área</Link></CardContent></Card>;
  return <>{children}</>;
}
