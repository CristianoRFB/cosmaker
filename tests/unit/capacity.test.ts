import { describe, expect, it } from 'vitest';
import { calculateCapacity } from '@/lib/calculations/capacity';

describe('calculateCapacity', () => {
  it('deduz horas usadas e reservadas da capacidade', () => {
    expect(calculateCapacity({ capacityHours: 120, usedHours: 68, reservedHours: 14 })).toEqual({
      capacityHours: 120, usedHours: 68, reservedHours: 14, allocatedHours: 82,
      availableHours: 38, occupancyPercent: 68, status: 'open',
    });
  });

  it('marca capacidade quase cheia a partir de 80 por cento', () => {
    expect(calculateCapacity({ capacityHours: 100, usedHours: 79, reservedHours: 1 }).status).toBe('almost_full');
  });

  it('marca como lotada quando as horas alocadas atingem ou passam a capacidade', () => {
    const full = calculateCapacity({ capacityHours: 100, usedHours: 100 });
    const over = calculateCapacity({ capacityHours: 100, usedHours: 92, reservedHours: 18 });
    expect(full.status).toBe('full');
    expect(over.availableHours).toBe(0);
    expect(over.occupancyPercent).toBe(110);
  });

  it('mantém bloqueios mesmo com horas disponíveis', () => {
    expect(calculateCapacity({ capacityHours: 40, usedHours: 0, blocked: true }).status).toBe('blocked');
  });

  it('rejeita valores inválidos', () => {
    expect(() => calculateCapacity({ capacityHours: 10, usedHours: -1 })).toThrow(RangeError);
    expect(() => calculateCapacity({ capacityHours: Number.NaN, usedHours: 0 })).toThrow(RangeError);
  });
});
