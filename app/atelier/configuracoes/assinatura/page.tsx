'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useTenant } from '@/providers/tenant-provider';
import { getTenantCommercialContext, type TenantCommercialContext } from '@/repositories/commercial.repository';
import { PLAN_CATALOG, SETUP_FEE_CENTS, TRIAL_DURATION_DAYS } from '@/lib/commercial/catalog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatOrderMoney } from '@/features/orders/order-format';

const labels: Record<string, string> = { active: 'Ativa', trial: 'Período de avaliação', demo: 'Demonstração', past_due: 'Pendência comercial', suspended: 'Suspensa comercialmente', cancelled: 'Cancelada' };
export default function PlanoEAssinatura() {
  const { firebaseUser } = useAuth(); const { atelierId, membershipValid } = useTenant();
  const [state, setState] = useState<{ key: string; context: TenantCommercialContext | null; error: string }>({ key: '', context: null, error: '' });
  const [revision, setRevision] = useState(0); const key = `${firebaseUser?.uid}/${atelierId}`;
  useEffect(() => {
    let active = true;
    if (atelierId && membershipValid) void getTenantCommercialContext().then(context => { if (active) setState({ key, context, error: '' }); })
      .catch(() => { if (active) setState({ key, context: null, error: 'Não foi possível consultar a situação comercial. Confira sua conexão e seu acesso.' }); });
    return () => { active = false; };
  }, [atelierId, membershipValid, key, revision]);
  const current = state.key === key ? state : null; const context = current?.context;
  const plan = context?.state ? PLAN_CATALOG.find(item => item.id === context.state?.planId) : null;
  return <section className="grid gap-5"><h1 className="text-2xl font-semibold">Assinatura do ateliê</h1>
    {!current ? <p role="status">Carregando situação comercial…</p> : null}
    {current?.error ? <Card className="p-5"><p role="alert" className="text-sm text-rose-800">{current.error}</p><Button variant="secondary" className="mt-3" onClick={() => setRevision(value => value + 1)}>Tentar novamente</Button></Card> : null}
    {context ? <Card className="grid gap-3 p-5"><h2 className="text-lg font-semibold">{plan?.name || (context.assignment === 'invalid_state' ? 'Situação a conferir' : 'Plano ainda não atribuído')}</h2><p>{context.state ? labels[context.state.subscriptionStatus] || context.state.subscriptionStatus : 'A atribuição do plano é feita manualmente pela administração.'}</p>
      {plan ? <p className="text-sm text-slate-600">Mensal {formatOrderMoney(plan.monthlyPriceCents / 100)} · Anual {formatOrderMoney(plan.annualPriceCents / 100)}</p> : null}
      {context.state?.trialUntil ? <p className="text-sm">Avaliação até {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(context.state.trialUntil))}{context.temporaryAccessExpired ? ' · prazo encerrado' : ''}</p> : null}
      {context.demoWorkspace ? <p className="text-sm text-amber-900">Espaço demonstrativo com dados fictícios.</p> : null}
      <p className="text-sm leading-6 text-slate-600">Alterações comerciais são atribuídas manualmente pela administração da plataforma. Histórico e dados operacionais são preservados.</p>
    </Card> : null}
    <div className="grid gap-3 md:grid-cols-3">{PLAN_CATALOG.map(item => <Card className="p-5" key={item.id}><h2 className="font-semibold">{item.name}</h2><p className="mt-3 text-lg font-bold">{formatOrderMoney(item.monthlyPriceCents / 100)}<span className="text-sm font-normal">/mês</span></p><p className="mt-2 text-sm text-slate-600">Anual: {formatOrderMoney(item.annualPriceCents / 100)}</p></Card>)}</div>
    <p className="text-sm leading-6 text-slate-600">Implantação: {formatOrderMoney(SETUP_FEE_CENTS / 100)}. Avaliação manual de {TRIAL_DURATION_DAYS} dias conforme a política aprovada. Esta tela consulta os registros comerciais existentes.</p>
  </section>;
}
