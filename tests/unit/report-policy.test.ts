import { describe, expect, it } from 'vitest';
import { operationalPreferences, reportPeriod, summarizeOperationalOrders, summarizeOperationalQuotes, type ReportOrder } from '../../functions/src/reports/policy';
const order = (id: string, changes: Partial<ReportOrder> = {}): ReportOrder => ({ id, character: 'Projeto sintético', status: 'in_production', progress: 40, createdDate: '2026-10-10', expectedDeliveryDate: '2026-10-20', ...changes });
describe('Operational report policy', () => {
  it('calcula dias civis no fuso do ateliê e não no UTC do servidor', () => {
    const preferences = operationalPreferences({ timezone: 'America/Sao_Paulo', defaultReportDays: 7 }, undefined);
    expect(reportPeriod(preferences, undefined, undefined, new Date('2026-10-22T01:00:00Z'))).toEqual({ from: '2026-10-15', to: '2026-10-21', today: '2026-10-21', timezone: 'America/Sao_Paulo' });
  });
  it('separa coorte criada no período de prazos abertos e não presume progresso ausente', () => {
    const rows = [order('a', { progress: 20 }), order('b', { progress: 60 }), order('old', { createdDate: '2026-08-01' }), order('cancelled', { status: 'cancelled' }), order('unknown', { progress: null }), order('done', { status: 'completed', progress: 100 })];
    const result = summarizeOperationalOrders(rows, { from: '2026-10-01', to: '2026-10-31', today: '2026-10-22' }, false);
    expect(result.total).toBe(4);
    expect(result.production).toMatchObject({ total: 3, averageProgress: 40, missingProgress: 1 });
    expect(result.deadlines).toMatchObject({ openDueInPeriod: 4, overdue: 4 });
    expect(result.byStatus).not.toHaveProperty('cancelled');
  });
  it('conta status de dados reais, preserva desconhecidos e não polui protótipos', () => {
    const result = summarizeOperationalQuotes([{ status: 'sent', createdDate: '2026-10-10' }, { status: 'approved', createdDate: '2026-09-01' }, { status: '__proto__', createdDate: '2026-10-11' }, { status: 'draft', createdDate: null }], { from: '2026-10-01', to: '2026-10-31' });
    expect(result.total).toBe(2); expect(result.byStatus.sent).toBe(1); expect(Object.hasOwn(result.byStatus, '__proto__')).toBe(true); expect(result.undatedCount).toBe(1);
  });
  it('nega preferências, datas e versões inválidas em vez de gerar métricas aparentes', () => {
    for (const value of [{ timezone: 'not/a-zone' }, { timezone: null }, { defaultReportDays: 0 }, { defaultReportDays: 1.5 }, { includeCancelledOrders: null }, { version: -1 }]) expect(() => operationalPreferences(value, undefined)).toThrow();
    const preferences = operationalPreferences(undefined, 'UTC');
    expect(() => reportPeriod(preferences, '2026-02-30', '2026-03-01', new Date())).toThrow();
    expect(() => reportPeriod(preferences, '2026-10-22', '2026-10-01', new Date())).toThrow();
  });
});
