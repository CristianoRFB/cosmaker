export const defaultProductionStages = [
  { id: 'stage-start', name: 'A iniciar', order: 0, progressWeight: 5, requiresClientApproval: false },
  { id: 'stage-modeling', name: 'Modelagem', order: 1, progressWeight: 15, requiresClientApproval: false },
  { id: 'stage-production', name: 'Em produção', order: 2, progressWeight: 35, requiresClientApproval: false },
  { id: 'stage-fitting', name: 'Prova e ajustes', order: 3, progressWeight: 20, requiresClientApproval: true },
  { id: 'stage-finishing', name: 'Finalização', order: 4, progressWeight: 15, requiresClientApproval: false },
  { id: 'stage-shipping', name: 'Envio', order: 5, progressWeight: 10, requiresClientApproval: false },
] as const;

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
