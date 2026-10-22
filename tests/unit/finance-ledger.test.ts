import { describe, expect, it } from 'vitest';
import { cents, financialOrder, marginBasisPoints, sumCents, summarizeFinance, type FinanceEntry } from '../../functions/src/finance/policy';

const order = { id: 'a', character: 'Armadura', status: 'confirmed', expectedDeliveryDate: '2027-01-01', revenueCents: 100_000, receivedCents: 30_000, remainingCents: 70_000 };
const expense = (amountCents: number, basis: 'planned' | 'actual'): FinanceEntry => ({ id: 'e', kind: 'expense', basis, category: 'labor', amountCents, description: 'Costura', effectiveDate: '2026-10-22', orderId: 'a', paymentId: null, method: null, reference: null, reversesEntryId: null, reason: null, createdAt: '2026-10-22T10:00:00Z' });
describe('Finance ledger policy', () => {
  it('mantém planejado/realizado separados e não duplica recebimentos no ledger', () => {
    const result = summarizeFinance([expense(40_000, 'planned'), expense(20_000, 'actual'), expense(-5_000, 'actual'), { ...expense(30_000, 'actual'), kind: 'payment' }], [order]);
    expect(result).toMatchObject({ plannedCostsCents: 40_000, actualCostsCents: 15_000, revenueCents: 100_000, receivedCents: 30_000, plannedResultCents: 60_000, actualResultCents: 15_000 });
    expect(result.byOrder[0]).toMatchObject({ resultCents: 85_000, marginBasisPoints: 8500 });
  });
  it('compensações preservam resultado correto, inclusive prejuízo e receita zero', () => {
    expect(summarizeFinance([expense(120_000, 'actual')], [order]).byOrder[0].marginBasisPoints).toBe(-2000);
    expect(marginBasisPoints(0, -100)).toBeNull();
    expect(summarizeFinance([], [{ ...order, status: 'cancelled' }])).toMatchObject({ revenueCents: 0, receivedCents: 30_000 });
  });
  it('rejeita frações de centavo, negativos e overflow de agregações', () => {
    for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => cents(value)).toThrow();
    expect(() => cents(0, true)).toThrow();
    expect(() => sumCents(Number.MAX_SAFE_INTEGER, 1)).toThrow();
    expect(sumCents(100, -25)).toBe(75);
  });
  it('compara saldos e centavos legados com o acordo vigente antes de qualquer mutação', () => {
    const stored = { quoteId: 'q', description: 'Armadura', expectedDeliveryDate: '2027-01-01', approvedQuoteSnapshot: { total: 1000, depositAmount: 300 }, amountPaid: 300, amountRemaining: 700, amountPaidCents: 30_000, amountRemainingCents: 70_000 };
    expect(financialOrder(stored)).toEqual({ revenueCents: 100_000, receivedCents: 30_000, remainingCents: 70_000 });
    expect(() => financialOrder({ ...stored, amountPaidCents: 29_999 })).toThrow();
    expect(() => financialOrder({ ...stored, amountRemaining: 600, amountRemainingCents: 60_000 })).toThrow();
  });
});
