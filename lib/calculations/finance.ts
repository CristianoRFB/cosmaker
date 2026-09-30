export interface OrderCostSummaryInput {
  revenue: number;
  materialCosts: number;
  shippingCosts?: number;
  paymentFees?: number;
  otherExpenses?: number;
}

export function calculateOrderResult(input: OrderCostSummaryInput) {
  const revenue = amount(input.revenue, 'revenue');
  const materialCosts = amount(input.materialCosts, 'materialCosts');
  const shippingCosts = amount(input.shippingCosts ?? 0, 'shippingCosts');
  const paymentFees = amount(input.paymentFees ?? 0, 'paymentFees');
  const otherExpenses = amount(input.otherExpenses ?? 0, 'otherExpenses');
  const totalCosts = materialCosts + shippingCosts + paymentFees + otherExpenses;
  return { revenue, totalCosts, result: revenue - totalCosts };
}

function amount(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${field} precisa ser um número finito e não negativo.`);
  return value;
}
