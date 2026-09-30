import { describe, expect, it } from 'vitest';
import { calculateWeightedProductionProgress, defaultProductionStages, orderStatusForStage } from '../../functions/src/orders/production-template';

describe('production template and progress', () => {
  it('defines the six documented stages with weights totaling 100', () => {
    expect(defaultProductionStages.map((stage) => stage.name)).toEqual([
      'A iniciar', 'Modelagem', 'Em produção', 'Prova e ajustes', 'Finalização', 'Envio',
    ]);
    expect(defaultProductionStages.reduce((sum, stage) => sum + stage.progressWeight, 0)).toBe(100);
    expect(defaultProductionStages.find((stage) => stage.requiresClientApproval)?.id).toBe('stage-fitting');
  });

  it('uses weighted stage completion for the order progress', () => {
    expect(calculateWeightedProductionProgress([
      { progress: 100, progressWeight: 20 }, { progress: 50, progressWeight: 80 },
    ])).toBe(60);
    expect(calculateWeightedProductionProgress([])).toBe(0);
  });

  it('rejects invalid weights and non-finite progress', () => {
    expect(() => calculateWeightedProductionProgress([{ progress: 10, progressWeight: -1 }])).toThrow(RangeError);
    expect(() => calculateWeightedProductionProgress([{ progress: Number.NaN, progressWeight: 1 }])).toThrow(RangeError);
  });

  it('maps production stages to documented order states', () => {
    expect(orderStatusForStage('stage-modeling', 'start')).toBe('modeling');
    expect(orderStatusForStage('stage-production', 'start')).toBe('in_production');
    expect(orderStatusForStage('stage-finishing', 'complete')).toBe('waiting_final_payment');
    expect(orderStatusForStage('stage-shipping', 'start')).toBe('ready_to_ship');
    expect(orderStatusForStage('stage-shipping', 'complete')).toBe('shipped');
  });
});
