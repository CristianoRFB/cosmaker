export interface QuoteTotalInput {
  materialsCost: number;
  laborCost: number;
  urgencyFee?: number;
  shipping?: number;
  discount?: number;
  depositPercentage: number;
}

export function calculateQuoteTotal(input: QuoteTotalInput) {
  const materialsCost = nonNegative(input.materialsCost, 'materialsCost');
  const laborCost = nonNegative(input.laborCost, 'laborCost');
  const urgencyFee = nonNegative(input.urgencyFee ?? 0, 'urgencyFee');
  const shipping = nonNegative(input.shipping ?? 0, 'shipping');
  const discount = nonNegative(input.discount ?? 0, 'discount');
  const depositPercentage = input.depositPercentage;
  if (!Number.isFinite(depositPercentage) || depositPercentage < 0 || depositPercentage > 100) {
    throw new RangeError('depositPercentage precisa estar entre 0 e 100.');
  }
  const subtotal = materialsCost + laborCost + urgencyFee + shipping;
  if (discount > subtotal) throw new RangeError('O desconto não pode ser maior que o subtotal.');
  const total = roundMoney(subtotal - discount);
  return { subtotal: roundMoney(subtotal), discount, total, depositPercentage, depositAmount: roundMoney(total * depositPercentage / 100) };
}

function nonNegative(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${field} precisa ser um número finito e não negativo.`);
  return value;
}

function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
