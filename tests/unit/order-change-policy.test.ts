import { describe, expect, it } from 'vitest';
import { agreementFingerprint, changeApplicationFinancials, currentOrderAgreement, moneyToCents, orderRemainingCents, proposedOrderAgreement, validAgreementDate } from '../../functions/src/orders/change-policy';
import { proposeOrderChangeSchema, respondOrderChangeSchema } from '@/schemas/order-change.schema';

const originalOrder = {
  quoteId: 'quote-original', description: 'Traje completo com capa', expectedDeliveryDate: '2027-03-15',
  amountPaid: 100, approvedQuoteSnapshot: { total: 500.25, depositAmount: 100, depositPercentage: 20 },
};

describe('Acordos versionados de pedido', () => {
  it('deriva snapshot original em centavos e produz revisão sem alterar o pedido aprovado', () => {
    const preserved = structuredClone(originalOrder);
    const base = currentOrderAgreement(originalOrder);
    const proposal = proposedOrderAgreement(base, { scope: 'Traje completo com bordados', materials: 'Linho e fita', expectedDeliveryDate: '2027-03-20', valueDeltaCents: 5025 });
    expect(base).toMatchObject({ version: 0, totalCents: 50025, depositAmountCents: 10000 });
    expect(proposal).toMatchObject({ version: 1, totalCents: 55050, depositAmountCents: 10000 });
    expect(agreementFingerprint(proposal)).not.toBe(agreementFingerprint(base));
    expect(changeApplicationFinancials(originalOrder, proposal)).toEqual({ paidCents: 10000, remainingCents: 45050 });
    expect(originalOrder).toEqual(preserved);
  });

  it('rejeita redução abaixo do depósito ou valor já pago e payload monetário sem precisão', () => {
    const base = currentOrderAgreement(originalOrder);
    expect(() => proposedOrderAgreement(base, { valueDeltaCents: -45026 })).toThrow('entrada original');
    const reduced = proposedOrderAgreement(base, { valueDeltaCents: -20000 });
    expect(() => changeApplicationFinancials({ ...originalOrder, amountPaid: 400 }, reduced)).toThrow('já registrado como pago');
    expect(moneyToCents(0.29)).toBe(29);
    expect(() => moneyToCents(1.001)).toThrow('precisão');
    expect(() => moneyToCents(Number.MAX_SAFE_INTEGER)).toThrow();
    expect(() => proposedOrderAgreement(base, { valueDeltaCents: 0.25 })).toThrow('centavos inteiros');
  });

  it('recusa proposta sem mudança, datas inexistentes e divergência entre acordo e pedido', () => {
    const base = currentOrderAgreement(originalOrder);
    expect(() => proposedOrderAgreement(base, { scope: base.scope, valueDeltaCents: 0 })).toThrow('ao menos');
    expect(validAgreementDate('2027-02-29')).toBe(false);
    expect(validAgreementDate('2028-02-29')).toBe(true);
    expect(() => proposedOrderAgreement(base, { expectedDeliveryDate: '2027-02-30' })).toThrow('data');
    const revised = proposedOrderAgreement(base, { materials: 'Couro sintético' });
    expect(() => currentOrderAgreement({ ...originalOrder, currentAgreement: revised, agreementVersion: 1, description: 'Edição externa' })).toThrow('fora do acordo');
    expect(currentOrderAgreement({ ...originalOrder, currentAgreement: revised, agreementVersion: 1 }).version).toBe(1);
  });

  it('exige confirmação explícita e assinatura da revisão, rejeitando campos de autoridade enviados pelo cliente', () => {
    const base = currentOrderAgreement(originalOrder);
    const response = { atelierId: 'tenant-a', orderId: 'order-a', changeRequestId: 'change-a', requestId: 'response-a', version: 1,
      proposalFingerprint: agreementFingerprint(base), decision: 'approved' as const, comment: '', confirmed: false };
    expect(respondOrderChangeSchema.safeParse(response).success).toBe(false);
    expect(respondOrderChangeSchema.safeParse({ ...response, confirmed: true }).success).toBe(true);
    expect(respondOrderChangeSchema.safeParse({ ...response, confirmed: true, approvedBy: 'another-client' }).success).toBe(false);
    expect(proposeOrderChangeSchema.safeParse({ atelierId: 'tenant-a', orderId: '../other-order', requestId: 'x', baseAgreementVersion: 0,
      baseAgreementFingerprint: agreementFingerprint(base), reason: 'Mudança solicitada', changes: { valueDeltaCents: 0 } }).success).toBe(false);
  });

  it('impede divergência dos saldos em reais e centavos de liberar envio ou mudança de acordo', () => {
    expect(orderRemainingCents({ amountRemaining: 0, amountRemainingCents: 0 })).toBe(0);
    expect(orderRemainingCents({ amountRemaining: 0.29 })).toBe(29);
    expect(() => orderRemainingCents({ amountRemaining: 0, amountRemainingCents: 100 })).toThrow('inconsistente');
    expect(() => orderRemainingCents({ amountRemaining: Number.NaN })).toThrow('inválido');
    expect(() => changeApplicationFinancials({ ...originalOrder, amountPaidCents: 10001 }, currentOrderAgreement(originalOrder))).toThrow('inconsistentes');
  });
});
