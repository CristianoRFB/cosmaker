import { z } from 'zod';

export const orderStatusSchema = z.enum([
  'requested', 'quoted', 'waiting_deposit', 'confirmed', 'waiting_materials', 'scheduled',
  'modeling', 'in_production', 'fitting', 'adjustments', 'finishing', 'waiting_final_payment',
  'ready_to_ship', 'shipped', 'delivered', 'completed', 'paused', 'cancelled', 'refunded',
]);

export const orderSchema = z.object({
  id: z.string(), atelierId: z.string(), quoteId: z.string(), requestId: z.string(),
  clientId: z.string().nullable(), clientName: z.string(), email: z.string().email(), character: z.string(),
  franchise: z.string(), category: z.string(), description: z.string(),
  status: orderStatusSchema, priority: z.enum(['low', 'normal', 'high', 'urgent']),
  progress: z.number().min(0).max(100), expectedDeliveryDate: z.string(),
  approvedQuoteSnapshot: z.object({ total: z.number().nonnegative(), depositAmount: z.number().nonnegative(), depositPercentage: z.number().min(0).max(100), expectedStartDate: z.string().nullable().optional(), expectedCompletionDate: z.string().nullable().optional() }),
  createdAt: z.unknown(), updatedAt: z.unknown(),
});
