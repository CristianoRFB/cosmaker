'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TenantFeatureAccess } from '@/repositories/commercial.repository';

const messages: Record<string, string> = {
  pending_assignment: 'A atribuição comercial ainda está pendente. O acesso aos fluxos principais do Cosmaker continua seguindo as permissões atuais.',
  invalid_state: 'O estado comercial precisa ser revisado pela administração da plataforma.',
  unknown_feature: 'Este recurso não tem uma política comercial cadastrada.',
  not_implemented: 'Este recurso ainda não está implementado.',
  test_only: 'Este recurso de validação só pode ser usado no Firebase Emulator.',
  status_restricted: 'O estado comercial atual não libera esta operação protegida.',
  expired: 'O período de acesso temporário terminou. Os dados foram preservados. Solicite uma revisão à administração da plataforma.',
  not_entitled: 'Este plano não tem uma política explícita para liberar esta operação. Solicite à administração uma revisão da atribuição comercial.',
  not_configured: 'O recurso está liberado, mas sua configuração operacional ainda não foi ativada.',
};

export function FeatureGating({
  access,
  loading = false,
  error,
  children,
  title = 'Recurso protegido',
}: {
  access?: TenantFeatureAccess | null;
  loading?: boolean;
  error?: string;
  children: ReactNode;
  title?: string;
}) {
  if (loading) return <Card aria-busy="true"><CardContent className="p-5 text-sm text-slate-500">Verificando disponibilidade do recurso…</CardContent></Card>;
  if (access?.available) return children;

  const denied = Boolean(error || access);
  return <Card className={denied ? 'border-amber-200 bg-amber-50/60' : ''} role="status">
    <CardHeader className="flex flex-row items-start gap-3 space-y-0">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-amber-700"><LockKeyhole aria-hidden="true" size={19} /></span>
      <div><CardTitle className="text-base">{title}</CardTitle><CardDescription className="mt-1 leading-6">{error ? `Acesso não autorizado pelo serviço: ${error}` : messages[access?.reason ?? 'pending_assignment']}</CardDescription></div>
    </CardHeader>
    {access?.reason === 'invalid_state' ? <CardContent className="flex items-center gap-2 pt-0 text-xs text-amber-900"><AlertTriangle size={15} />Entre em contato com a administração da plataforma.</CardContent> : null}
    {!denied ? <CardContent className="flex items-center gap-2 pt-0 text-xs text-slate-500"><ShieldCheck size={15} />A disponibilidade depende da política configurada no servidor.</CardContent> : null}
  </Card>;
}
