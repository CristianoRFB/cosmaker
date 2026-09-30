export interface ProductionProgressInput { progress: number; progressWeight: number; }

export function calculateOrderProgress(stages: ProductionProgressInput[]) {
  if (stages.length === 0) return 0;
  const totalWeight = stages.reduce((sum, stage) => sum + finiteNonNegative(stage.progressWeight, 'progressWeight'), 0);
  if (totalWeight === 0) return 0;
  const completedWeight = stages.reduce((sum, stage) => {
    if (!Number.isFinite(stage.progress)) throw new RangeError('progress precisa ser finito.');
    const progress = Math.min(100, Math.max(0, stage.progress));
    return sum + progress * stage.progressWeight;
  }, 0);
  return Math.round(completedWeight / totalWeight);
}

function finiteNonNegative(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${field} precisa ser um número finito e não negativo.`);
  return value;
}
