import { describe, expect, it } from 'vitest';
import { quoteDraftSchema } from '@/schemas/quote.schema';
import { quoteRequestSchema } from '@/schemas/quote-request.schema';

const requestInput = {
  name: 'Aline Cosmaker',
  email: '  ALINE@EXAMPLE.COM ',
  character: 'A personagem',
  franchise: 'Uma franquia',
  category: 'full_cosplay' as const,
  description: 'Quero um cosplay completo para o evento.',
  desiredDeliveryDate: '2027-02-28',
  urgency: 'normal' as const,
};

describe('quote request and draft schemas', () => {
  it('normalizes contact email and treats an empty optional event date as absent', () => {
    const result = quoteRequestSchema.parse({ ...requestInput, eventDate: '' });
    expect(result.email).toBe('aline@example.com');
    expect(result.eventDate).toBeUndefined();
  });

  it('rejects impossible calendar dates before saving a request', () => {
    expect(quoteRequestSchema.safeParse({ ...requestInput, desiredDeliveryDate: '2027-02-31' }).success).toBe(false);
  });

  it('rejects a draft with an impossible date or discount above the item total', () => {
    const base = {
      requestId: 'request-1',
      items: [{ description: 'Espuma EVA', category: 'material' as const, quantity: 1, unitPrice: 50 }],
      urgencyFee: 0, shipping: 0, discount: 0, validUntil: '2027-02-28', depositPercentage: 30,
    };
    expect(quoteDraftSchema.safeParse({ ...base, validUntil: '2027-02-31' }).success).toBe(false);
    expect(quoteDraftSchema.safeParse({ ...base, discount: 51 }).success).toBe(false);
  });
});
