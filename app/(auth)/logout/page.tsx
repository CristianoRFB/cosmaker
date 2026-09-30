'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '@/services/firebase/auth.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LogoutPage() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    logout().then(() => router.replace('/login')).catch((problem: unknown) => setError(problem instanceof Error ? problem.message : 'Não foi possível sair.'));
  }, [router]);
  return <Card><CardHeader><CardTitle>Saindo da sua conta</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-600">{error || 'Sua sessão está sendo encerrada com segurança.'}</p>{error ? <button className="mt-4 font-semibold text-violet-700" onClick={() => router.replace('/login')} type="button">Voltar para entrar</button> : null}</CardContent></Card>;
}
