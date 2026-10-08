'use client';

import { useState, type FormEvent } from 'react';
import { Clock3, History, ShieldAlert, Sparkles } from 'lucide-react';
import { PLAN_CATALOG, TEST_ONLY_FEATURE_KEY, TEST_ONLY_LIMIT_KEY } from '@/lib/commercial/catalog';
import { endPlatformDemoTenant, updatePlatformTenantCommercialState, type CommercialUpdateRequest, type PlatformAtelierDetail } from '@/repositories/admin.repository';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';

type CommercialAudit = PlatformAtelierDetail['commercialAudit'][number];
type PendingAction = { label: string; detail: string; request?: CommercialUpdateRequest; endDemo?: true };
const planNames = Object.fromEntries(PLAN_CATALOG.map((plan) => [plan.id, plan.name]));
const statusNames: Record<string, string> = { trial: 'Trial', active: 'Ativo', past_due: 'Pendente', suspended: 'Suspenso', cancelled: 'Cancelado', demo: 'Demonstração' };

function auditSummary(value: unknown) {
  if (!value || typeof value !== 'object') return 'Sem estado anterior';
  const state = value as Record<string, unknown>;
  const plan = typeof state.planId === 'string' ? planNames[state.planId] ?? state.planId : null;
  const status = typeof state.subscriptionStatus === 'string' ? statusNames[state.subscriptionStatus] ?? state.subscriptionStatus : null;
  return [plan, status].filter(Boolean).join(' · ') || 'Overrides comerciais';
}

function actionName(action: string) {
  return ({
    'platform.commercial.plan_assigned': 'Plano atribuído ou alterado',
    'platform.commercial.status_changed': 'Estado comercial alterado',
    'platform.commercial.trial_started': 'Trial Premium iniciado',
    'platform.commercial.entitlement_override_set': 'Override de recurso definido',
    'platform.commercial.entitlement_override_cleared': 'Override de recurso removido',
    'platform.commercial.limit_override_set': 'Override de limite definido',
    'platform.commercial.limit_override_cleared': 'Override de limite removido',
    'platform.commercial.demo_created': 'Demonstração criada',
    'platform.commercial.demo_ended': 'Demonstração encerrada',
  } as Record<string, string>)[action] ?? action;
}

function formatDate(value: string | null) {
  if (!value) return 'Data indisponível';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : date.toLocaleString('pt-BR');
}

export function CommercialStateManager({ atelierId, commercial, audit, onUpdated }: {
  atelierId: string;
  commercial: PlatformAtelierDetail['commercial'];
  audit: CommercialAudit[];
  onUpdated: () => void;
}) {
  const existing = commercial.state;
  const [planId, setPlanId] = useState<'essencial' | 'pro' | 'premium'>(existing?.planId ?? 'essencial');
  const [status, setStatus] = useState<'active' | 'past_due' | 'suspended' | 'cancelled'>(existing && ['active', 'past_due', 'suspended', 'cancelled'].includes(existing.subscriptionStatus) ? existing.subscriptionStatus as 'active' | 'past_due' | 'suspended' | 'cancelled' : 'active');
  const [reason, setReason] = useState('');
  const [overrideEnabled, setOverrideEnabled] = useState(existing?.entitlementOverrides?.[TEST_ONLY_FEATURE_KEY] ?? true);
  const [limitValue, setLimitValue] = useState(() => String(existing?.limitOverrides?.[TEST_ONLY_LIMIT_KEY] ?? 2));
  const [unlimited, setUnlimited] = useState(existing ? Object.prototype.hasOwnProperty.call(existing.limitOverrides ?? {}, TEST_ONLY_LIMIT_KEY) && existing.limitOverrides?.[TEST_ONLY_LIMIT_KEY] === null : false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const isEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';

  function prepare(event: FormEvent, next: PendingAction) {
    event.preventDefault(); setError(''); setSuccess('');
    if (reason.trim().length < 8) { setError('Informe um motivo com pelo menos 8 caracteres.'); return; }
    setPending(next);
  }

  async function execute() {
    if (!pending) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      if (pending.endDemo) {
        const result = await endPlatformDemoTenant(atelierId, reason.trim());
        setSuccess(result.accountDisabled ? 'Demonstração encerrada. O acesso foi desativado e a página foi despublicada; os dados foram preservados.' : 'Demonstração encerrada e página despublicada. A conta Auth precisa ser desativada manualmente.');
      } else if (pending.request) {
        await updatePlatformTenantCommercialState(pending.request);
        setSuccess('Estado comercial atualizado e registrado na auditoria.');
      }
      setPending(null); setReason(''); onUpdated();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Não foi possível alterar o estado comercial.'); }
    finally { setBusy(false); }
  }

  return <div className="grid gap-5">
    <Card><CardHeader><CardTitle className="flex flex-wrap items-center gap-2">Estado comercial <Badge tone={commercial.assignment === 'assigned' ? 'green' : commercial.assignment === 'pending_assignment' ? 'amber' : 'red'}>{commercial.assignment === 'assigned' ? existing?.subscriptionStatus : commercial.assignment === 'pending_assignment' ? 'Atribuição pendente' : 'Estado inválido'}</Badge>{commercial.demoWorkspace ? <Badge tone="violet">DEMONSTRAÇÃO — PREMIUM</Badge> : null}</CardTitle><CardDescription>Alterações são manuais, exigem motivo e ficam em auditoria. Mantêm a situação operacional do ateliê e preservam os dados.</CardDescription></CardHeader><CardContent className="grid gap-5">
      {commercial.error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert">{commercial.error}</p> : null}
      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p> : null}
      {success ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{success}</p> : null}
      <label className="grid max-w-3xl gap-1.5 text-sm font-medium text-slate-700">Motivo para esta alteração<Input maxLength={500} minLength={8} onChange={(event) => setReason(event.target.value)} placeholder="Descreva o motivo administrativo" value={reason} /></label>
      {existing ? <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-xl bg-slate-50 p-4 text-sm"><p><span className="text-slate-500">Plano:</span> <strong>{planNames[existing.planId]}</strong></p><p><span className="text-slate-500">Estado:</span> <strong>{statusNames[existing.subscriptionStatus]}</strong></p><p><span className="text-slate-500">Trial até:</span> <strong>{existing.trialUntil ? formatDate(existing.trialUntil) : '—'}</strong></p></div> : <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Este tenant não recebeu uma atribuição comercial. O fluxo operacional legado permanece preservado.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <form className="grid content-start gap-3 rounded-2xl border border-slate-200 p-4" onSubmit={(event) => prepare(event, { label: 'Atribuir plano e status', detail: `Definir ${planNames[planId]} · ${statusNames[status]}.`, request: { operation: 'assign_plan', atelierId, planId, subscriptionStatus: status, reason: reason.trim() } })}>
          <div><h3 className="font-semibold text-slate-950">Atribuir plano</h3><p className="mt-1 text-xs leading-5 text-slate-600">Apenas atualiza estado comercial. Não cobra nem altera dados.</p></div>
          <select aria-label="Plano comercial" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" disabled={commercial.demoWorkspace} onChange={(event) => setPlanId(event.target.value as typeof planId)} value={planId}>{PLAN_CATALOG.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}{plan.recommended ? ' · recomendado' : ''}</option>)}</select>
          <select aria-label="Status comercial" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" disabled={commercial.demoWorkspace} onChange={(event) => setStatus(event.target.value as typeof status)} value={status}>{(['active', 'past_due', 'suspended', 'cancelled'] as const).map((item) => <option key={item} value={item}>{statusNames[item]}</option>)}</select>
          <Button disabled={commercial.demoWorkspace} type="submit">Revisar atribuição</Button>
        </form>
        <div className="grid content-start gap-3 rounded-2xl border border-slate-200 p-4">
          <div><h3 className="font-semibold text-slate-950">Iniciar trial Premium</h3><p className="mt-1 text-xs leading-5 text-slate-600">14 dias, sem cartão. O servidor calcula e grava a data final uma única vez.</p></div>
          <Button disabled={commercial.demoWorkspace || Boolean(existing?.trialUntil) || existing?.subscriptionStatus === 'trial'} onClick={(event) => prepare(event as unknown as FormEvent, { label: 'Iniciar trial Premium', detail: 'Conceder 14 dias de experiência Premium, sem cobrança.', request: { operation: 'start_trial', atelierId, reason: reason.trim() } })} variant="secondary"><Clock3 size={16} />Iniciar trial autorizado</Button>
          {existing?.trialUntil || existing?.subscriptionStatus === 'trial' ? <p className="text-xs text-slate-500">Um trial já foi concedido para este tenant.</p> : null}
          {commercial.demoWorkspace ? <p className="text-xs text-slate-500">Demonstrações não podem ser convertidas em trial.</p> : null}
        </div>
      </div>
      {isEmulator ? <div className="grid gap-4 rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 p-4 lg:grid-cols-2"><div className="lg:col-span-2"><p className="flex items-center gap-2 font-semibold text-violet-950"><ShieldAlert size={17} />Overrides TEST_ONLY · Emulator</p><p className="mt-1 text-xs leading-5 text-violet-800">Chaves sintéticas para validar enforcement. São rejeitadas fora do Firebase Emulator e não pertencem à matriz comercial.</p></div>
        <form className="grid gap-2" onSubmit={(event) => prepare(event, { label: 'Salvar entitlement TEST_ONLY', detail: `${TEST_ONLY_FEATURE_KEY} será ${overrideEnabled ? 'liberado' : 'bloqueado'}.`, request: { operation: 'set_entitlement_override', atelierId, featureKey: TEST_ONLY_FEATURE_KEY, enabled: overrideEnabled, reason: reason.trim() } })}>
          <p className="break-all text-xs font-mono">{TEST_ONLY_FEATURE_KEY}</p><select aria-label="Entitlement sintético" className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" onChange={(event) => setOverrideEnabled(event.target.value === 'true')} value={String(overrideEnabled)}><option value="true">Liberado</option><option value="false">Bloqueado</option></select><div className="flex flex-wrap gap-2"><Button disabled={!existing} type="submit" variant="secondary">Salvar política de teste</Button>{Object.prototype.hasOwnProperty.call(existing?.entitlementOverrides ?? {}, TEST_ONLY_FEATURE_KEY) ? <Button disabled={!existing} onClick={(event) => prepare(event as unknown as FormEvent, { label: 'Remover entitlement TEST_ONLY', detail: 'Remover o override e voltar à política do plano.', request: { operation: 'clear_entitlement_override', atelierId, featureKey: TEST_ONLY_FEATURE_KEY, reason: reason.trim() } })} variant="ghost">Remover override</Button> : null}</div>
        </form>
        <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); const value = unlimited ? null : Number(limitValue); prepare(event, { label: 'Salvar limite TEST_ONLY', detail: `${TEST_ONLY_LIMIT_KEY}: ${value === null ? 'sem teto explícito' : value}.`, request: { operation: 'set_limit_override', atelierId, limitKey: TEST_ONLY_LIMIT_KEY, limit: value, reason: reason.trim() } }); }}>
          <p className="break-all text-xs font-mono">{TEST_ONLY_LIMIT_KEY}</p><div className="flex gap-2"><Input aria-label="Valor do limite sintético" disabled={unlimited} min={0} onChange={(event) => setLimitValue(event.target.value)} type="number" value={unlimited ? '' : limitValue} /><label className="flex shrink-0 items-center gap-2 text-xs text-slate-700"><input checked={unlimited} onChange={(event) => setUnlimited(event.target.checked)} type="checkbox" />null</label></div><div className="flex flex-wrap gap-2"><Button disabled={!existing || (!unlimited && (!/^\d+$/.test(limitValue) || Number(limitValue) > Number.MAX_SAFE_INTEGER))} type="submit" variant="secondary">Salvar limite de teste</Button>{Object.prototype.hasOwnProperty.call(existing?.limitOverrides ?? {}, TEST_ONLY_LIMIT_KEY) ? <Button disabled={!existing} onClick={(event) => prepare(event as unknown as FormEvent, { label: 'Remover limite TEST_ONLY', detail: 'Remover o override e voltar ao estado sem política configurada.', request: { operation: 'clear_limit_override', atelierId, limitKey: TEST_ONLY_LIMIT_KEY, reason: reason.trim() } })} variant="ghost">Remover override</Button> : null}</div>
        </form>
      </div> : <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">Não há overrides de recurso ou cotas numéricas aprovados para produção. A administração não oferece controles comerciais fictícios.</div>}
      {commercial.demoWorkspace ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="flex items-center gap-2 font-semibold text-amber-950"><Sparkles size={16} />Encerrar demonstração</p><p className="mt-1 text-xs leading-5 text-amber-900">Desativa o acesso Demo e despublica a página. Mantém o ateliê operacional e preserva todo o conteúdo sintético.</p><Button className="mt-3" onClick={(event) => prepare(event as unknown as FormEvent, { label: 'Encerrar demonstração', detail: 'Desativar acesso Demo, despublicar a página e preservar os dados.', endDemo: true })} variant="danger">Encerrar demonstração</Button></div> : null}
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><History size={18} className="text-violet-700" />Auditoria comercial</CardTitle><CardDescription>Ator, motivo e valores anteriores e novos registrados no backend.</CardDescription></CardHeader><CardContent>{audit.length ? <ol className="grid gap-3">{audit.map((entry) => <li className="rounded-xl border border-slate-100 p-4" key={entry.id}><div className="flex flex-col justify-between gap-1 sm:flex-row"><p className="font-semibold text-slate-900">{actionName(entry.action)}</p><time className="text-xs text-slate-500">{formatDate(entry.timestamp)}</time></div><p className="mt-1 text-xs text-slate-600">Ator {entry.actorId} · Motivo: {entry.reason || 'não informado'}</p><p className="mt-2 text-xs text-slate-700">{auditSummary(entry.before)} → {auditSummary(entry.after)}</p></li>)}</ol> : <p className="text-sm text-slate-600">Nenhuma alteração comercial auditada para este tenant.</p>}</CardContent></Card>
    <ConfirmDialog confirmDisabled={busy} confirmLabel={busy ? 'Aplicando…' : 'Confirmar alteração'} description={pending ? `${pending.detail} Motivo: ${reason.trim()}` : ''} onClose={() => setPending(null)} onConfirm={() => void execute()} open={Boolean(pending)} title={pending?.label ?? 'Confirmar alteração comercial?'} />
  </div>;
}
