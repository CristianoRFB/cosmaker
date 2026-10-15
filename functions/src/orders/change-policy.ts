import { createHash } from 'node:crypto';

export interface OrderAgreementSnapshot {
  version: number;
  sourceQuoteId: string;
  scope: string;
  materials: string;
  expectedDeliveryDate: string;
  totalCents: number;
  depositAmountCents: number;
}

export interface OrderChangeTerms {
  scope?: string;
  materials?: string;
  expectedDeliveryDate?: string;
  valueDeltaCents?: number;
}

export class OrderChangePolicyError extends Error {}

export function moneyToCents(value: unknown, label = 'Valor'): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new OrderChangePolicyError(`${label} inválido no pedido.`);
  }
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 0.000001) {
    throw new OrderChangePolicyError(`${label} precisa ter precisão de centavos.`);
  }
  return cents;
}

function storedCents(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new OrderChangePolicyError('O acordo contém valor inválido.');
  return value;
}

export function validAgreementDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function currentOrderAgreement(order: Record<string, unknown>): OrderAgreementSnapshot {
  const current = order.currentAgreement as Record<string, unknown> | undefined;
  const version = order.agreementVersion ?? 0;
  if (!Number.isSafeInteger(version) || Number(version) < 0) throw new OrderChangePolicyError('A versão do acordo é inválida.');
  if (current) {
    if (current.version !== version || typeof current.scope !== 'string' || typeof current.materials !== 'string'
      || typeof current.sourceQuoteId !== 'string' || !validAgreementDate(current.expectedDeliveryDate)) {
      throw new OrderChangePolicyError('O snapshot do acordo precisa ser revisado.');
    }
    if (current.scope !== order.description || current.expectedDeliveryDate !== order.expectedDeliveryDate) {
      throw new OrderChangePolicyError('O pedido foi alterado fora do acordo vigente. Revise o histórico antes de propor outra mudança.');
    }
    const agreement = {
      version: Number(version), sourceQuoteId: current.sourceQuoteId, scope: current.scope, materials: current.materials,
      expectedDeliveryDate: current.expectedDeliveryDate, totalCents: storedCents(current.totalCents),
      depositAmountCents: storedCents(current.depositAmountCents),
    };
    if (agreement.depositAmountCents > agreement.totalCents) throw new OrderChangePolicyError('A entrada original é superior ao total do acordo.');
    return agreement;
  }
  if (version !== 0) throw new OrderChangePolicyError('O snapshot do acordo vigente não foi encontrado.');
  const quote = order.approvedQuoteSnapshot as Record<string, unknown> | undefined;
  if (!quote || typeof order.quoteId !== 'string' || typeof order.description !== 'string' || !validAgreementDate(order.expectedDeliveryDate)) {
    throw new OrderChangePolicyError('O pedido não tem um acordo original válido.');
  }
  const agreement = {
    version: 0, sourceQuoteId: order.quoteId, scope: order.description, materials: '',
    expectedDeliveryDate: order.expectedDeliveryDate,
    totalCents: moneyToCents(quote.total, 'Total aprovado'),
    depositAmountCents: moneyToCents(quote.depositAmount, 'Entrada aprovada'),
  };
  if (agreement.depositAmountCents > agreement.totalCents) throw new OrderChangePolicyError('A entrada original é superior ao total do acordo.');
  return agreement;
}

export function agreementFingerprint(agreement: OrderAgreementSnapshot): string {
  return createHash('sha256').update(JSON.stringify([
    agreement.version, agreement.sourceQuoteId, agreement.scope, agreement.materials,
    agreement.expectedDeliveryDate, agreement.totalCents, agreement.depositAmountCents,
  ])).digest('hex');
}

export function proposedOrderAgreement(base: OrderAgreementSnapshot, changes: OrderChangeTerms): OrderAgreementSnapshot {
  const delta = changes.valueDeltaCents ?? 0;
  if (!Number.isSafeInteger(delta)) throw new OrderChangePolicyError('A variação de valor deve usar centavos inteiros.');
  const totalCents = base.totalCents + delta;
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || totalCents < base.depositAmountCents) {
    throw new OrderChangePolicyError('O novo total não pode ficar abaixo da entrada original nem ser negativo.');
  }
  if (moneyToCents(totalCents / 100, 'Novo total') !== totalCents) throw new OrderChangePolicyError('O novo total excede a precisão monetária suportada pelo pedido legado.');
  if (changes.expectedDeliveryDate !== undefined && !validAgreementDate(changes.expectedDeliveryDate)) {
    throw new OrderChangePolicyError('Informe uma data de entrega válida.');
  }
  if (!Number.isSafeInteger(base.version + 1)) throw new OrderChangePolicyError('A versão do acordo excedeu o intervalo permitido.');
  const proposed = {
    ...base, version: base.version + 1, scope: changes.scope ?? base.scope,
    materials: changes.materials ?? base.materials,
    expectedDeliveryDate: changes.expectedDeliveryDate ?? base.expectedDeliveryDate, totalCents,
  };
  if (base.scope === proposed.scope && base.materials === proposed.materials
    && base.expectedDeliveryDate === proposed.expectedDeliveryDate && base.totalCents === proposed.totalCents) {
    throw new OrderChangePolicyError('A proposta precisa alterar ao menos uma condição do acordo.');
  }
  return proposed;
}

export function changeApplicationFinancials(order: Record<string, unknown>, proposed: OrderAgreementSnapshot) {
  const paidCents = moneyToCents(order.amountPaid, 'Total pago registrado');
  if (order.amountPaidCents !== undefined && storedCents(order.amountPaidCents) !== paidCents) throw new OrderChangePolicyError('Os valores pago em reais e centavos estão inconsistentes.');
  if (proposed.totalCents < paidCents) throw new OrderChangePolicyError('O novo total fica abaixo do valor já registrado como pago. Registre o ajuste financeiro antes de aplicar a mudança.');
  return { paidCents, remainingCents: proposed.totalCents - paidCents };
}

/** Legacy reais and new cents must agree; neither representation may silently bypass the shipping gate. */
export function orderRemainingCents(order: Record<string, unknown>) {
  const remainingCents = moneyToCents(order.amountRemaining, 'Saldo registrado');
  if (order.amountRemainingCents !== undefined && storedCents(order.amountRemainingCents) !== remainingCents) throw new OrderChangePolicyError('O saldo em reais e centavos está inconsistente.');
  return remainingCents;
}
