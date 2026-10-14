import { describe, expect, it } from 'vitest';
import {
  parseScheduleDate,
  scheduleDateRange,
  scheduleIntervalsOverlap,
  scheduleLocalDate,
  scheduleLocalMinute,
  scheduleWeekday,
  validScheduleTimestamp,
  validScheduleTimezone,
} from '../../functions/src/scheduling/allocate-capacity';
import { scheduleBlockedHours, scheduleRisk, sumScheduledHours } from '../../functions/src/scheduling/recalculate-capacity';

describe('regras locais de agenda', () => {
  it('valida datas civis, limita períodos e calcula o dia da semana em UTC', () => {
    expect(parseScheduleDate('2026-02-28')).toBe('2026-02-28');
    expect(parseScheduleDate('2026-02-30')).toBeNull();
    expect(scheduleDateRange('2026-10-14', '2026-10-16')).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
    expect(scheduleDateRange('2026-10-14', '2026-12-01', 31)).toBeNull();
    expect(scheduleWeekday('2026-10-12')).toBe(1);
  });

  it('converte horários pelo fuso configurado e rejeita timestamps inválidos', () => {
    expect(scheduleLocalDate('2026-10-14T12:00:00.000Z', 'America/Sao_Paulo')).toBe('2026-10-14');
    expect(scheduleLocalMinute('2026-10-14T12:00:00.000Z', 'America/Sao_Paulo')).toBe(540);
    expect(validScheduleTimezone('America/Sao_Paulo')).toBe(true);
    expect(validScheduleTimezone('Mars/Olympus')).toBe(false);
    expect(validScheduleTimestamp('2026-02-30T10:00:00Z')).toBe(false);
    expect(validScheduleTimestamp('2026-10-14T10:00:00Z')).toBe(true);
  });

  it('detecta sobreposição e soma apenas horas planejadas ativas', () => {
    expect(scheduleIntervalsOverlap(10, 20, 19, 30)).toBe(true);
    expect(scheduleIntervalsOverlap(10, 20, 20, 30)).toBe(false);
    expect(sumScheduledHours([
      { plannedHours: 2, status: 'scheduled' },
      { plannedHours: 4, status: 'cancelled' },
      { plannedHours: 1 },
    ])).toBe(2);
  });

  it('calcula horas bloqueadas sem somar duas vezes intervalos coincidentes', () => {
    expect(scheduleBlockedHours([
      { startMinute: 540, endMinute: 660, status: 'active' },
      { startMinute: 600, endMinute: 720, status: 'active' },
      { startMinute: 720, endMinute: 780, status: 'cancelled' },
    ], 8, 480, 960)).toBe(3);
    expect(scheduleBlockedHours([{ allDay: true, status: 'active' }], 4, 480, 960)).toBe(4);
  });
});

describe('risco de cronograma baseado em dados persistidos', () => {
  const common = {
    deliveryDate: '2026-10-30', eventDate: '2026-10-28', orderStatus: 'in_production',
    openStageDeadlines: ['2026-10-24'], openStageCount: 2, scheduledStageIds: ['stage-1'],
  };

  it('sinaliza prazo vencido, conflito com evento e etapas ainda sem alocação', () => {
    expect(scheduleRisk(common, '2026-10-25')).toMatchObject({ level: 'high' });
    expect(scheduleRisk({ ...common, deliveryDate: '2026-10-29' }, '2026-10-20').reasons)
      .toContain('A entrega prevista ocorre depois do evento informado.');
    expect(scheduleRisk({ ...common, deliveryDate: null, eventDate: null, openStageDeadlines: [], scheduledStageIds: [] }, '2026-10-20'))
      .toMatchObject({ level: 'planning' });
  });

  it('não sinaliza atraso em pedido terminal e informa ausência de prazo sem inventar percentual', () => {
    expect(scheduleRisk({ ...common, orderStatus: 'completed' }, '2026-12-01').level).toBe('clear');
    expect(scheduleRisk({ ...common, deliveryDate: null, eventDate: null, openStageDeadlines: [], openStageCount: 0, scheduledStageIds: [] }, '2026-10-20'))
      .toMatchObject({ level: 'unknown', reasons: ['Não há prazo cadastrado para avaliar o risco.'] });
  });

  it('marca atenção quando horas persistidas foram planejadas depois do prazo da etapa', () => {
    const result = scheduleRisk({
      ...common, deliveryDate: '2026-11-30', eventDate: null,
      openStageDeadlines: ['2026-10-28'], openStageCount: 1,
      scheduledStageIds: ['stage-1'], lateScheduledStageCount: 1,
    }, '2026-10-20');
    expect(result).toMatchObject({ level: 'medium' });
    expect(result.reasons).toContain('Há horas planejadas depois do prazo de uma etapa.');
  });
});
