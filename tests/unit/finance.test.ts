import { describe, expect, it } from 'vitest';
import { calculateOrderResult } from '@/lib/calculations/finance';

describe('calculateOrderResult', () => {
  it('separa receita, custos e resultado do pedido', () => {
    expect(calculateOrderResult({ revenue: 4000, materialCosts: 1200, shippingCosts: 100, paymentFees: 80, otherExpenses: 200 })).toEqual({ revenue: 4000, totalCosts: 1580, result: 2420 });
  });
  it('rejeita valores negativos ou não finitos', () => {
    expect(() => calculateOrderResult({ revenue: -1, materialCosts: 0 })).toThrow(RangeError);
  });
});
