import { describe, expect, it } from 'vitest';
import { capRequestSchema, toCapQuotePayload } from '@/schemas/cap-request.schema';
import { parseCapCustomization, describeCapCustomization, categoryMatchesBusinessType } from '@/functions/src/public/cap-policy';

const valid = {
  name: 'Cliente Teste', email: ' CLIENTE@EXAMPLE.COM ', model: 'Modelo autoral',
  capColor: 'Vinho', frontArtwork: 'Arte bordada na frente', backArtwork: 'Nome no verso',
  quantity: '2', desiredDeliveryDate: '2027-12-12', urgency: 'normal',
};

describe('contrato de personalização de bonés', () => {
  it('nega bonés em tenants de cosplay e vice-versa', () => {
    expect(categoryMatchesBusinessType('custom_cap', 'caps')).toBe(true);
    expect(categoryMatchesBusinessType('custom_cap', 'cosmaker')).toBe(false);
    expect(categoryMatchesBusinessType('full_cosplay', 'caps')).toBe(false);
    expect(categoryMatchesBusinessType('full_cosplay', 'cosmaker')).toBe(true);
  });
  it('normaliza formulário e preserva dados estruturados', () => {
    const parsed = capRequestSchema.parse(valid);
    expect(parsed.email).toBe('cliente@example.com');
    expect(parsed.quantity).toBe(2);
    const payload = toCapQuotePayload(parsed);
    expect(payload.category).toBe('custom_cap');
    expect(parseCapCustomization(payload.capCustomization).quantity).toBe(2);
    expect(describeCapCustomization(payload.capCustomization)).toContain('Arte bordada');
  });
  it('rejeita quantidade, datas e orçamento inválidos', () => {
    expect(capRequestSchema.safeParse({ ...valid, quantity: '0' }).success).toBe(false);
    expect(capRequestSchema.safeParse({ ...valid, quantity: '51' }).success).toBe(false);
    expect(capRequestSchema.safeParse({ ...valid, desiredDeliveryDate: '2027-02-30' }).success).toBe(false);
    expect(capRequestSchema.safeParse({ ...valid, budgetMin: '200', budgetMax: '100' }).success).toBe(false);
  });
  it('rejeita adulterações e campos inesperados no servidor', () => {
    const parsed = toCapQuotePayload(capRequestSchema.parse(valid));
    expect(() => parseCapCustomization({ ...parsed.capCustomization, atelierId: 'outro-tenant' })).toThrow('não permitidos');
    expect(() => parseCapCustomization({ ...parsed.capCustomization, quantity: 1.5 })).toThrow();
    expect(() => parseCapCustomization({ ...parsed.capCustomization, frontArtwork: '' })).toThrow();
  });
});
