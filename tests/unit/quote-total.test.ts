import { describe, expect, it } from 'vitest';
import { calculateQuoteTotal } from '@/lib/calculations/quote-total';

describe('calculateQuoteTotal', () => {
  it('soma custos, aplica desconto e calcula o sinal', () => {
    expect(calculateQuoteTotal({ materialsCost: 2800, laborCost: 1000, urgencyFee: 200, shipping: 50, discount: 50, depositPercentage: 40 })).toEqual({
      subtotal: 4050, discount: 50, total: 4000, depositPercentage: 40, depositAmount: 1600,
    });
  });
  it('rejeita desconto acima do subtotal e sinal fora do intervalo', () => {
    expect(() => calculateQuoteTotal({ materialsCost: 0, laborCost: 10, discount: 11, depositPercentage: 50 })).toThrow(RangeError);
    expect(() => calculateQuoteTotal({ materialsCost: 10, laborCost: 0, depositPercentage: 101 })).toThrow(RangeError);
  });
  it('inclui itens classificados como outros no subtotal e no sinal', () => {
    expect(calculateQuoteTotal({ materialsCost: 100, laborCost: 200, otherCost: 50, discount: 10, depositPercentage: 25 })).toMatchObject({ subtotal: 350, total: 340, depositAmount: 85 });
  });
});
