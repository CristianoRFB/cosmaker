import { z } from 'zod';

const isoDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}, 'Informe uma data válida.');

const optionalBudget = z.union([z.literal(''), z.coerce.number().finite().nonnegative()]).optional()
  .transform((value) => value === '' ? undefined : value);

export const capRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(30).optional(),
  model: z.string().trim().min(2).max(100),
  capColor: z.string().trim().min(2).max(60),
  frontArtwork: z.string().trim().min(3).max(400),
  backArtwork: z.string().trim().max(400).optional(),
  quantity: z.coerce.number().int().min(1).max(50),
  desiredDeliveryDate: isoDate,
  urgency: z.enum(['normal', 'urgent']),
  budgetMin: optionalBudget,
  budgetMax: optionalBudget,
  observations: z.string().trim().max(1000).optional(),
}).refine((value) => value.budgetMin === undefined || value.budgetMax === undefined
  || value.budgetMin <= value.budgetMax, { path: ['budgetMax'], message: 'O valor máximo precisa ser maior que o mínimo.' });

export type CapRequestFormData = z.infer<typeof capRequestSchema>;
export interface CapQuotePayload {
  name: string;
  email: string;
  phone?: string;
  category: 'custom_cap';
  capCustomization: { model: string; capColor: string; frontArtwork: string; backArtwork?: string; quantity: number };
  desiredDeliveryDate: string;
  urgency: 'normal' | 'urgent';
  budgetMin?: number;
  budgetMax?: number;
  observations?: string;
}

export function toCapQuotePayload(value: CapRequestFormData): CapQuotePayload {
  return {
    name: value.name, email: value.email, ...(value.phone ? { phone: value.phone } : {}),
    category: 'custom_cap',
    capCustomization: {
      model: value.model,
      capColor: value.capColor,
      frontArtwork: value.frontArtwork,
      ...(value.backArtwork ? { backArtwork: value.backArtwork } : {}),
      quantity: value.quantity,
    },
    desiredDeliveryDate: value.desiredDeliveryDate, urgency: value.urgency,
    ...(value.budgetMin !== undefined ? { budgetMin: value.budgetMin } : {}),
    ...(value.budgetMax !== undefined ? { budgetMax: value.budgetMax } : {}),
    ...(value.observations ? { observations: value.observations } : {}),
  };
}
