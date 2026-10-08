'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Clock3, Info, Sparkles } from 'lucide-react';
import { getTenantCommercialContext, type TenantCommercialContext } from '@/repositories/commercial.repository';

const statusLabel: Record<string, string> = {
  active: 'Ativo', trial: 'Trial', past_due: 'Pendente', suspended: 'Suspenso comercialmente', cancelled: 'Cancelado', demo: 'Demonstração',
};

function dateLabel(value: string | null | undefined) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function TenantCommercialBanner() {
  const [context, setContext] = useState<TenantCommercialContext | null>(null);

  useEffect(() => {
    let mounted = true;
    void getTenantCommercialContext().then((result) => { if (mounted) setContext(result); }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  if (!context) return null;
  if (context.demoWorkspace || context.state?.subscriptionStatus === 'demo') {
    return <div className="mb-5 flex items-start gap-3 rounded-2xl border border-violet-300 bg-violet-50 px-4 py-3 text-violet-950" role="status">
      <Sparkles aria-hidden="true" className="mt-0.5 shrink-0 text-violet-700" size={18} />
      <div><p className="text-sm font-bold">DEMONSTRAÇÃO — PLANO PREMIUM</p><p className="mt-1 text-xs leading-5 text-violet-800">Ambiente com dados fictícios. Confirmações financeiras e uploads de produção ficam desativados.</p></div>
    </div>;
  }
  if (context.assignment === 'pending_assignment') {
    return <div className="mb-5 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-950" role="status">
      <Info aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
      <div><p className="text-sm font-semibold">Atribuição comercial pendente</p><p className="mt-1 text-xs leading-5 text-sky-800">Os fluxos principais continuam usando as permissões atuais. Nenhuma cota ou diferença entre planos foi presumida.</p></div>
    </div>;
  }
  if (context.assignment !== 'assigned' || !context.state) return null;

  const until = dateLabel(context.state.trialUntil);
  const isTrial = context.state.subscriptionStatus === 'trial';
  return <div className="mb-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800" role="status">
    {isTrial ? <Clock3 aria-hidden="true" className="mt-0.5 shrink-0 text-violet-700" size={18} /> : <BadgeCheck aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-700" size={18} />}
    <div><p className="text-sm font-semibold">Plano {context.state.planId[0].toUpperCase() + context.state.planId.slice(1)} · {statusLabel[context.state.subscriptionStatus] ?? context.state.subscriptionStatus}</p>
      {isTrial ? <p className="mt-1 text-xs leading-5 text-slate-600">{context.temporaryAccessExpired ? `Experiência Premium encerrada em ${until} (UTC). Dados preservados; solicite uma revisão à administração.` : until ? `Experiência Premium válida até ${until} (UTC).` : 'Trial sem prazo válido. A administração da plataforma precisa revisar a atribuição.'} Não é necessário cadastrar cartão.</p> : null}
      {['past_due', 'suspended', 'cancelled'].includes(context.state.subscriptionStatus) ? <p className="mt-1 text-xs leading-5 text-slate-600">Dados e histórico permanecem preservados. Operações principais seguem as permissões atuais quando nenhuma política comercial foi configurada.</p> : null}
    </div>
  </div>;
}
