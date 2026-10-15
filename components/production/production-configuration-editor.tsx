'use client';

import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { getOrderProductionConfiguration, saveOrderProductionConfiguration } from '@/repositories/production.repository';
import type { OrderProductionConfiguration, ProductionConfigurationStage, ProductionSemanticKey } from '@/types/production';

const phases: Record<ProductionSemanticKey, string> = { confirmed: 'Preparação', modeling: 'Modelagem', in_production: 'Produção', fitting: 'Prova e ajustes', finishing: 'Finalização', shipping: 'Envio' };
const phaseOrder: Record<ProductionSemanticKey, number> = { confirmed: 0, modeling: 1, in_production: 2, fitting: 3, finishing: 4, shipping: 5 };

export function ProductionConfigurationEditor({ atelierId, orderId, reload, disabled }: {
  atelierId: string; orderId: string; reload: () => Promise<void>; disabled: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [configuration, setConfiguration] = useState<OrderProductionConfiguration | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPhase, setCustomPhase] = useState<ProductionSemanticKey>('in_production');
  const request = useRef<{ fingerprint: string; id: string } | null>(null);

  async function load() {
    setBusy(true); setError(''); setOpen(true);
    try { setConfiguration(await getOrderProductionConfiguration(atelierId, orderId)); request.current = null; }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a configuração.'); }
    finally { setBusy(false); }
  }

  function updateStage(id: string, patch: Partial<ProductionConfigurationStage>) {
    setConfiguration((current) => current ? { ...current, stages: current.stages.map((stage) => stage.id === id ? { ...stage, ...patch } : stage) } : current);
  }

  function addStage() {
    if (customName.trim().length < 2) { setError('Informe o nome da nova etapa.'); return; }
    if (configuration && !canInsertPhase(configuration.stages, customPhase)) { setError('Escolha uma fase que ainda permita incluir trabalho sem alterar o histórico de etapas iniciadas.'); return; }
    setConfiguration((current) => {
      if (!current) return current;
      const stages = [...current.stages];
      const insertion = stages.findIndex((stage) => phaseOrder[stage.semanticKey] > phaseOrder[customPhase]);
      const stage: ProductionConfigurationStage = { id: `custom-${crypto.randomUUID()}`, name: customName.trim(), progressWeight: 10, requiresClientApproval: false, semanticKey: customPhase, assignedTo: null, plannedStartDate: null, deadline: null, expectedUpdatedAt: null, status: 'pending', version: 0 };
      stages.splice(insertion < 0 ? stages.length - 1 : insertion, 0, stage);
      return { ...current, stages };
    });
    setCustomName(''); setError('');
  }

  function moveStage(index: number, direction: -1 | 1) {
    setConfiguration((current) => {
      if (!current) return current;
      const stages = [...current.stages];
      const neighbor = stages[index + direction];
      if (!neighbor || neighbor.status !== 'pending' || neighbor.id === 'stage-shipping' || neighbor.semanticKey !== stages[index].semanticKey) return current;
      [stages[index], stages[index + direction]] = [stages[index + direction], stages[index]];
      return { ...current, stages };
    });
  }

  async function save() {
    if (!configuration) return;
    const invalid = configuration.stages.find((stage) => stage.name.trim().length < 2 || !Number.isInteger(stage.progressWeight) || stage.progressWeight < 1 || stage.progressWeight > 10000 || (stage.plannedStartDate && stage.deadline && stage.plannedStartDate > stage.deadline));
    if (invalid) { setError('Revise nomes, pesos e datas das etapas antes de salvar.'); return; }
    const fingerprint = JSON.stringify(configuration);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      await saveOrderProductionConfiguration({ atelierId, orderId, requestId: request.current.id, expectedVersion: configuration.version, stages: configuration.stages });
      request.current = null; setOpen(false); setConfiguration(null);
      toast('Configuração da produção salva no pedido.', 'success'); await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar. Sua configuração permanece disponível para tentar novamente.'); }
    finally { setBusy(false); }
  }

  if (!open) return <Button disabled={disabled} onClick={() => void load()} variant="secondary"><Settings2 size={16} />Configurar etapas, responsáveis e prazos</Button>;
  return <Card className="border-violet-200">
    <CardHeader><CardTitle>Configuração da produção</CardTitle><p className="text-sm text-slate-600">As seis fases originais preservam a sequência do pedido. Etapas próprias podem detalhar cada fase. Etapas iniciadas e alocações da agenda preservam seu histórico.</p></CardHeader>
    <CardContent>
      {error ? <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p> : null}
      {busy && !configuration ? <p role="status">Carregando etapas e equipe…</p> : null}
      {configuration ? <div className="grid gap-4">
        {configuration.stages.map((stage, index) => {
          const locked = stage.status !== 'pending';
          const complete = ['completed', 'approved', 'waiting_approval'].includes(stage.status ?? '');
          const custom = stage.id.startsWith('custom-');
          return <section className="rounded-xl border border-slate-200 p-4" key={stage.id}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{index + 1}. {phases[stage.semanticKey]}{custom ? ' · etapa própria' : ' · fase original'}</strong>{locked ? <span className="text-xs text-slate-600">Definição preservada no histórico</span> : custom ? <div className="flex gap-2"><Button aria-label={`Mover ${stage.name} para cima`} disabled={busy || index === 0 || configuration.stages[index - 1]?.status !== 'pending' || configuration.stages[index - 1]?.semanticKey !== stage.semanticKey} onClick={() => moveStage(index, -1)} variant="ghost"><ArrowUp size={16} /></Button><Button aria-label={`Mover ${stage.name} para baixo`} disabled={busy || configuration.stages[index + 1]?.status !== 'pending' || configuration.stages[index + 1]?.semanticKey !== stage.semanticKey} onClick={() => moveStage(index, 1)} variant="ghost"><ArrowDown size={16} /></Button><Button aria-label={`Remover ${stage.name}`} disabled={busy} onClick={() => setConfiguration((current) => current ? { ...current, stages: current.stages.filter((item) => item.id !== stage.id) } : current)} variant="danger"><Trash2 size={16} /></Button></div> : null}</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm">Nome<Input disabled={busy || locked} maxLength={100} onChange={(event) => updateStage(stage.id, { name: event.target.value })} value={stage.name} /></label>
              <label className="text-sm">Peso no progresso<Input disabled={busy || locked} max={10000} min={1} onChange={(event) => updateStage(stage.id, { progressWeight: Number(event.target.value) })} type="number" value={stage.progressWeight} /></label>
              <label className="text-sm">Responsável<select className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" disabled={busy || complete} onChange={(event) => updateStage(stage.id, { assignedTo: event.target.value || null })} value={stage.assignedTo ?? ''}><option value="">Sem responsável</option>{stage.assignedTo && !configuration.members.some((member) => member.id === stage.assignedTo) ? <option value={stage.assignedTo}>Membro indisponível</option> : null}{configuration.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
              <label className="text-sm">Início planejado<Input disabled={busy || complete} onChange={(event) => updateStage(stage.id, { plannedStartDate: event.target.value || null })} type="date" value={stage.plannedStartDate ?? ''} /></label>
              <label className="text-sm">Prazo da etapa<Input disabled={busy || complete} onChange={(event) => updateStage(stage.id, { deadline: event.target.value || null })} type="date" value={stage.deadline ?? ''} /></label>
              <label className="flex items-center gap-2 self-center text-sm"><input checked={stage.requiresClientApproval} disabled={busy || locked || stage.id === 'stage-fitting'} onChange={(event) => updateStage(stage.id, { requiresClientApproval: event.target.checked })} type="checkbox" />Exigir aprovação do cliente</label>
            </div>
          </section>;
        })}
        <div className="grid gap-3 rounded-xl bg-violet-50 p-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-sm">Nome da etapa própria<Input disabled={busy} maxLength={100} onChange={(event) => setCustomName(event.target.value)} placeholder="Ex.: Pintura de acessórios" value={customName} /></label>
          <label className="text-sm">Fase<select className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" disabled={busy} onChange={(event) => setCustomPhase(event.target.value as ProductionSemanticKey)} value={customPhase}>{(['modeling', 'in_production', 'fitting', 'finishing'] as const).map((phase) => <option disabled={!canInsertPhase(configuration.stages, phase)} key={phase} value={phase}>{phases[phase]}</option>)}</select></label>
          <Button className="self-end" disabled={busy || configuration.stages.length >= 100} onClick={addStage} variant="secondary"><Plus size={16} />Adicionar etapa</Button>
        </div>
        <p className="text-xs text-slate-600">Os pesos são proporcionais entre todas as etapas. As datas não substituem as horas da agenda. Para reatribuir uma etapa já alocada, cancele suas horas na agenda primeiro.</p>
      </div> : null}
      <div className="mt-4 flex flex-wrap gap-2"><Button disabled={busy || !configuration} onClick={() => void save()}>Salvar configuração</Button><Button disabled={busy} onClick={() => void load()} variant="secondary">Recarregar configuração</Button><Button disabled={busy} onClick={() => setOpen(false)} variant="ghost">Fechar</Button></div>
    </CardContent>
  </Card>;
}

function canInsertPhase(stages: ProductionConfigurationStage[], phase: ProductionSemanticKey) {
  const insertion = stages.findIndex((stage) => phaseOrder[stage.semanticKey] > phaseOrder[phase]);
  return insertion >= 0 && stages.slice(insertion).every((stage) => stage.status === 'pending');
}
