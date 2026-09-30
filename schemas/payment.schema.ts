import { z } from 'zod';
export const paymentSchema = z.object({
  id: z.string(),
  type: z.enum(['deposit', 'installment', 'final', 'refund']),
  amount: z.number().nonnegative(),
  method: z.enum(['pix', 'bank_transfer', 'cash', 'card', 'other']).nullable().optional(),
  status: z.enum(['pending', 'generated', 'paid', 'overdue', 'cancelled', 'refunded']),
  dueDate: z.string().nullable().optional(),
  reference: z.string().max(120).nullable().optional(),
});
