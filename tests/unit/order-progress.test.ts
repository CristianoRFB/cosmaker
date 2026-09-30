import { describe, expect, it } from 'vitest';
import { calculateOrderProgress } from '@/lib/calculations/order-progress';

describe('calculateOrderProgress', () => {
  it('calcula o progresso ponderado das etapas', () => {
    expect(calculateOrderProgress([{ progress: 100, progressWeight: 1 }, { progress: 50, progressWeight: 3 }])).toBe(63);
  });
  it('retorna zero sem etapas ou sem pesos', () => {
    expect(calculateOrderProgress([])).toBe(0);
    expect(calculateOrderProgress([{ progress: 100, progressWeight: 0 }])).toBe(0);
  });
  it('limita o progresso de cada etapa ao intervalo de 0 a 100', () => {
    expect(calculateOrderProgress([{ progress: 150, progressWeight: 1 }, { progress: -5, progressWeight: 1 }])).toBe(50);
  });
  it('rejeita pesos negativos e valores não finitos', () => {
    expect(() => calculateOrderProgress([{ progress: 10, progressWeight: -1 }])).toThrow(RangeError);
    expect(() => calculateOrderProgress([{ progress: Infinity, progressWeight: 1 }])).toThrow(RangeError);
  });
});
