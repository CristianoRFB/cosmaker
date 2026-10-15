import { describe, expect, it } from 'vitest';
import {
  canonicalProductionSemantics, defaultProductionStages, productionSemantic,
  statusAfterProductionCompletion, validateProductionConfiguration, validProductionDate,
  type ProductionConfigurationStage,
} from '../../functions/src/orders/production-template';

function configuration(): ProductionConfigurationStage[] {
  return defaultProductionStages.map((stage) => ({
    ...stage, semanticKey: canonicalProductionSemantics[stage.id], assignedTo: null,
    plannedStartDate: null, deadline: null, expectedUpdatedAt: null,
  }));
}

function custom(id: string, phase: ProductionConfigurationStage['semanticKey']): ProductionConfigurationStage {
  return { id: `custom-${id}`, name: 'Etapa própria', progressWeight: 10, requiresClientApproval: false, semanticKey: phase, assignedTo: null, plannedStartDate: null, deadline: null, expectedUpdatedAt: null };
}

describe('configurable production integrity', () => {
  it('accepts additional work inside a canonical phase and keeps shipping last', () => {
    const next = configuration(); next.splice(3, 0, custom('paint', 'in_production'));
    expect(validateProductionConfiguration(next, [])).toBeNull();
    expect(productionSemantic(next[3])).toBe('in_production');
  });

  it('preserves all canonical stages and the mandatory fitting approval', () => {
    const missing = configuration().filter((stage) => stage.id !== 'stage-modeling');
    expect(validateProductionConfiguration(missing, [])).toMatch(/seis/);
    const noApproval = configuration(); noApproval[3].requiresClientApproval = false;
    expect(validateProductionConfiguration(noApproval, [])).toMatch(/aprovação obrigatória/);
  });

  it('rejects duplicated IDs, phase reversal and a custom shipping gate', () => {
    const duplicate = configuration(); duplicate.splice(3, 0, { ...duplicate[2] });
    expect(validateProductionConfiguration(duplicate, [])).toMatch(/único/);
    const reversed = configuration(); reversed.splice(1, 0, custom('late-phase', 'finishing'));
    expect(validateProductionConfiguration(reversed, [])).toMatch(/ordem/);
    const fakeShipping = configuration(); fakeShipping.splice(5, 0, custom('ship', 'shipping'));
    expect(validateProductionConfiguration(fakeShipping, [])).toMatch(/fase operacional/);
    expect(() => productionSemantic({ id: 'custom-ship', semanticKey: 'shipping' })).toThrow();
  });

  it('keeps the executed definition and position immutable while pending work can be renamed', () => {
    const next = configuration();
    const prior = next.map((stage, order) => ({ ...stage, order, status: order === 0 ? 'completed' : 'pending' }));
    next[1].name = 'Modelagem sob medida';
    expect(validateProductionConfiguration(next, prior)).toBeNull();
    next[0].progressWeight = 20;
    expect(validateProductionConfiguration(next, prior)).toMatch(/histórico/);
  });

  it('rejects removing executed custom work and changing completed metadata', () => {
    const next = configuration(); next.splice(3, 0, custom('paint', 'in_production'));
    const prior = next.map((stage, order) => ({ ...stage, order, status: stage.id === 'custom-paint' ? 'in_progress' : 'pending' }));
    expect(validateProductionConfiguration(next.filter((stage) => stage.id !== 'custom-paint'), prior)).toMatch(/removida/);
    prior[0].status = 'completed'; next[0].assignedTo = 'another-member';
    expect(validateProductionConfiguration(next, prior)).toMatch(/dados de uma etapa concluída/);
  });

  it('validates calendar dates, ranges and reproducible positive weights', () => {
    expect(validProductionDate('2028-02-29')).toBe(true);
    expect(validProductionDate('2026-02-29')).toBe(false);
    const next = configuration(); next[1].progressWeight = 0;
    expect(validateProductionConfiguration(next, [])).toMatch(/peso/);
    next[1].progressWeight = 15; next[1].plannedStartDate = '2026-10-25'; next[1].deadline = '2026-10-24';
    expect(validateProductionConfiguration(next, [])).toMatch(/posterior/);
  });

  it('keeps finalization active until custom work is completed, then enters the financial gate', () => {
    const canonical = { id: 'stage-finishing' };
    const customStage = { id: 'custom-paint', semanticKey: 'finishing' };
    const stages = [...configuration().map((stage) => ({ ...stage, status: 'completed' })), { ...customStage, status: 'pending' }];
    expect(statusAfterProductionCompletion(canonical, stages, 100)).toBe('finishing');
    expect(statusAfterProductionCompletion(customStage, stages, 100)).toBe('waiting_final_payment');
    expect(statusAfterProductionCompletion(customStage, stages, 0)).toBe('ready_to_ship');
    expect(statusAfterProductionCompletion({ id: 'stage-shipping' }, stages, 0)).toBe('shipped');
  });
});
