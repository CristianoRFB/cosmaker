export const defaultProductionStages = [
  { id: 'stage-start', name: 'A iniciar', order: 0, progressWeight: 5, requiresClientApproval: false },
  { id: 'stage-modeling', name: 'Modelagem', order: 1, progressWeight: 15, requiresClientApproval: false },
  { id: 'stage-production', name: 'Em produção', order: 2, progressWeight: 35, requiresClientApproval: false },
  { id: 'stage-fitting', name: 'Prova e ajustes', order: 3, progressWeight: 20, requiresClientApproval: true },
  { id: 'stage-finishing', name: 'Finalização', order: 4, progressWeight: 15, requiresClientApproval: false },
  { id: 'stage-shipping', name: 'Envio', order: 5, progressWeight: 10, requiresClientApproval: false },
] as const;

export type ProductionSemanticKey = 'confirmed' | 'modeling' | 'in_production' | 'fitting' | 'finishing' | 'shipping';
export const canonicalProductionSemantics: Record<string, ProductionSemanticKey> = {
  'stage-start': 'confirmed', 'stage-modeling': 'modeling', 'stage-production': 'in_production',
  'stage-fitting': 'fitting', 'stage-finishing': 'finishing', 'stage-shipping': 'shipping',
};
const phaseOrder: Record<ProductionSemanticKey, number> = { confirmed: 0, modeling: 1, in_production: 2, fitting: 3, finishing: 4, shipping: 5 };

export interface ProductionConfigurationStage {
  id: string;
  name: string;
  progressWeight: number;
  requiresClientApproval: boolean;
  semanticKey: ProductionSemanticKey;
  assignedTo: string | null;
  plannedStartDate: string | null;
  deadline: string | null;
  expectedUpdatedAt: string | null;
}

export function validProductionDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

/** Canonical phases keep their semantics; custom work runs inside one of those phases. */
export function validateProductionConfiguration(
  next: ProductionConfigurationStage[],
  existing: Array<Record<string, unknown> & { id: string }>,
): string | null {
  if (next.length < defaultProductionStages.length || next.length > 100) return 'A configuração aceita as seis etapas canônicas e até 100 etapas por transação.';
  if (new Set(next.map((stage) => stage.id)).size !== next.length) return 'Cada etapa precisa ter um identificador único.';
  for (const stage of defaultProductionStages) {
    const configured = next.find((item) => item.id === stage.id);
    if (!configured || configured.semanticKey !== canonicalProductionSemantics[stage.id]) return 'As seis etapas canônicas e suas fases precisam ser preservadas.';
    if (stage.requiresClientApproval && !configured.requiresClientApproval) return 'A aprovação obrigatória da etapa de prova e ajustes precisa ser preservada.';
  }
  if (next.at(-1)?.id !== 'stage-shipping') return 'A etapa canônica de envio precisa permanecer por último.';
  let phase = -1;
  for (const [index, stage] of next.entries()) {
    if (!canonicalProductionSemantics[stage.id] && (!stage.id.startsWith('custom-') || !['modeling', 'in_production', 'fitting', 'finishing'].includes(stage.semanticKey))) return 'Etapas próprias precisam ter uma fase operacional válida.';
    if (phaseOrder[stage.semanticKey] < phase) return 'A ordem precisa respeitar modelagem, produção, prova, finalização e envio.';
    phase = phaseOrder[stage.semanticKey];
    if (!Number.isSafeInteger(stage.progressWeight) || stage.progressWeight <= 0 || stage.progressWeight > 10000) return 'O peso precisa ser um inteiro entre 1 e 10.000.';
    if (stage.plannedStartDate && !validProductionDate(stage.plannedStartDate)) return 'A data planejada de início é inválida.';
    if (stage.deadline && !validProductionDate(stage.deadline)) return 'O prazo da etapa é inválido.';
    if (stage.plannedStartDate && stage.deadline && stage.plannedStartDate > stage.deadline) return 'O início planejado não pode ser posterior ao prazo.';
    const prior = existing.find((item) => item.id === stage.id);
    if (prior && prior.status !== 'pending') {
      const priorSemantic = canonicalProductionSemantics[prior.id] ?? prior.semanticKey;
      if (prior.order !== index || prior.name !== stage.name || prior.progressWeight !== stage.progressWeight
        || prior.requiresClientApproval !== stage.requiresClientApproval || priorSemantic !== stage.semanticKey) return 'Nome, peso, aprovação, fase e posição de uma etapa já iniciada fazem parte do histórico.';
      if (['completed', 'approved'].includes(String(prior.status)) && ((prior.assignedTo ?? null) !== stage.assignedTo
        || (prior.plannedStartDate ?? null) !== stage.plannedStartDate || (prior.deadline ?? null) !== stage.deadline)) return 'Os dados de uma etapa concluída precisam permanecer no histórico.';
    }
  }
  if (existing.some((stage) => stage.status !== 'pending' && !next.some((item) => item.id === stage.id))) return 'Uma etapa já iniciada não pode ser removida.';
  return null;
}

export function productionSemantic(stage: { id: string; semanticKey?: unknown }): ProductionSemanticKey {
  const canonical = canonicalProductionSemantics[stage.id];
  if (canonical) return canonical;
  if (stage.id.startsWith('custom-') && ['modeling', 'in_production', 'fitting', 'finishing'].includes(String(stage.semanticKey))) return stage.semanticKey as ProductionSemanticKey;
  throw new RangeError('A etapa não tem uma fase operacional válida.');
}

export function statusAfterProductionCompletion(
  current: { id: string; semanticKey?: unknown },
  stages: Array<{ id: string; status: string; semanticKey?: unknown }>,
  amountRemaining: number,
) {
  if (current.id === 'stage-shipping') return 'shipped';
  const workRemaining = stages.some((stage) => stage.id !== current.id && stage.id !== 'stage-shipping' && !['completed', 'approved'].includes(stage.status));
  if (!workRemaining) return amountRemaining === 0 ? 'ready_to_ship' : 'waiting_final_payment';
  return productionSemantic(current);
}

export function calculateWeightedProductionProgress(stages: Array<{ progress: number; progressWeight: number }>) {
  if (!stages.length) return 0;
  const total = stages.reduce((sum, stage) => sum + stage.progressWeight, 0);
  if (total <= 0 || !Number.isFinite(total)) throw new RangeError('O peso total das etapas precisa ser positivo e finito.');
  const complete = stages.reduce((sum, stage) => {
    if (!Number.isFinite(stage.progress) || !Number.isFinite(stage.progressWeight) || stage.progressWeight < 0) {
      throw new RangeError('Progresso e peso precisam ser números finitos e não negativos.');
    }
    return sum + Math.min(100, Math.max(0, stage.progress)) * stage.progressWeight;
  }, 0);
  return Math.round(complete / total);
}

export function orderStatusForStage(stageId: string, action: 'start' | 'complete'): 'confirmed' | 'modeling' | 'in_production' | 'fitting' | 'finishing' | 'waiting_final_payment' | 'ready_to_ship' | 'shipped' {
  if (stageId === 'stage-modeling') return action === 'start' ? 'modeling' : 'modeling';
  if (stageId === 'stage-production') return 'in_production';
  if (stageId === 'stage-fitting') return action === 'start' ? 'fitting' : 'fitting';
  if (stageId === 'stage-finishing') return action === 'start' ? 'finishing' : 'waiting_final_payment';
  if (stageId === 'stage-shipping' && action === 'start') return 'ready_to_ship';
  if (stageId === 'stage-shipping' && action === 'complete') return 'shipped';
  return 'confirmed';
}
