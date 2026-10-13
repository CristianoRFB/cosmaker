import { z } from 'zod';

const normalizedPhone = z.string().trim().max(32).transform((value) => value.replace(/[\s()-]/g, ''));

export const clientInputSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do cliente.').max(120),
  email: z.string().trim().email('Informe um e-mail válido.').max(254).transform((value) => value.toLowerCase()),
  phone: normalizedPhone.optional().default(''),
});

export const clientInteractionSchema = z.object({
  note: z.string().trim().min(2, 'Descreva a interação.').max(2000),
});

export const schema = z.object({
  id: z.string().min(1).max(150),
  hasLinkedAccount: z.boolean(),
  name: z.string().min(2).max(120),
  email: z.string().email().max(254),
  phone: z.string().max(32),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type ClientInput = z.infer<typeof clientInputSchema>;
