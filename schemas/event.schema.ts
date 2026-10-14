import { z } from 'zod';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const eventTypes = ['cosplay', 'convention', 'deadline', 'prop_deadline', 'other'] as const;
export const eventSchema = z.object({
  title: z.string().trim().min(2).max(100),
  type: z.enum(eventTypes),
  startDate: date,
  endDate: date,
  orderId: z.string().trim().min(1).max(150).optional().nullable(),
  notes: z.string().trim().max(500).optional().default(''),
}).refine((event) => event.startDate <= event.endDate, {
  message: 'A data final precisa ser igual ou posterior à inicial.', path: ['endDate'],
});

export type EventInput = z.infer<typeof eventSchema>;
