import { moneyToCents, orderRemainingCents, currentOrderAgreement } from '../orders/change-policy';

export const financeCategories = ['materials', 'production', 'labor', 'operational', 'shipping', 'fees', 'other'] as const;
export type FinanceCategory = typeof financeCategories[number];
export type FinanceKind = 'expense' | 'income' | 'payment';
export type FinanceBasis = 'planned' | 'actual';
export interface FinanceEntry {
  id: string; kind: FinanceKind; basis: FinanceBasis; category: FinanceCategory;
  amountCents: number; description: string; effectiveDate: string; orderId: string | null;
  paymentId: string | null; method: string | null; reference: string | null;
  reversesEntryId: string | null; reason: string | null; createdAt: string;
}
export interface FinanceOrder {
  id: string; character: string; status: string; expectedDeliveryDate: string;
  revenueCents: number; receivedCents: number; remainingCents: number;
}
export class FinancePolicyError extends Error {}

export function cents(value: unknown, positive = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new FinancePolicyError('O valor deve usar centavos inteiros e seguros.');
  }
  // New totals also preserve the legacy reais fields consumed by existing order gates.
  if (moneyToCents(value / 100) !== value) throw new FinancePolicyError('O valor excede a precisão monetária suportada.');
  return value;
}
export function sumCents(...values: number[]) {
  const result = values.reduce((total, value) => total + BigInt(value), 0n);
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new FinancePolicyError('O total excede o intervalo monetário seguro.');
  }
  return Number(result);
}
export function financialOrder(order: Record<string, unknown>) {
  const revenueCents = currentOrderAgreement(order).totalCents;
  const receivedCents = moneyToCents(order.amountPaid, 'Recebimentos');
  if (order.amountPaidCents !== undefined && cents(order.amountPaidCents) !== receivedCents) {
    throw new FinancePolicyError('Os recebimentos em reais e centavos estão inconsistentes.');
  }
  const remainingCents = orderRemainingCents(order);
  if (sumCents(receivedCents, remainingCents) !== revenueCents) throw new FinancePolicyError('O saldo não corresponde ao acordo vigente.');
  return { revenueCents, receivedCents, remainingCents };
}
export function marginBasisPoints(revenue: number, result: number) {
  if (revenue === 0) return null;
  return Number(BigInt(result) * 10_000n / BigInt(revenue));
}
export function summarizeFinance(entries: FinanceEntry[], orders: FinanceOrder[]) {
  const activeOrders = orders.filter((order) => !['cancelled', 'refunded'].includes(order.status));
  const total = (kind: FinanceKind, basis: FinanceBasis) => sumCents(...entries.filter((entry) => entry.kind === kind && entry.basis === basis).map((entry) => entry.amountCents));
  const plannedCostsCents = total('expense', 'planned');
  const actualCostsCents = total('expense', 'actual');
  const revenueCents = sumCents(...activeOrders.map((order) => order.revenueCents), total('income', 'planned'));
  // Order receipts are counted once from their canonical balance, never again from the audit ledger.
  const receivedCents = sumCents(...orders.map((order) => order.receivedCents), total('income', 'actual'));
  const plannedResultCents = sumCents(revenueCents, -plannedCostsCents);
  const actualResultCents = sumCents(receivedCents, -actualCostsCents);
  const byOrder = orders.map((order) => {
    const own = entries.filter((entry) => entry.orderId === order.id && entry.kind === 'expense');
    const plannedCostsCents = sumCents(...own.filter((entry) => entry.basis === 'planned').map((entry) => entry.amountCents));
    const actualCostsCents = sumCents(...own.filter((entry) => entry.basis === 'actual').map((entry) => entry.amountCents));
    const resultCents = sumCents(order.revenueCents, -actualCostsCents);
    return { ...order, plannedCostsCents, actualCostsCents, resultCents, marginBasisPoints: marginBasisPoints(order.revenueCents, resultCents) };
  });
  return { plannedCostsCents, actualCostsCents, revenueCents, receivedCents, plannedResultCents, actualResultCents,
    marginBasisPoints: marginBasisPoints(revenueCents, sumCents(revenueCents, -actualCostsCents)), byOrder };
}
