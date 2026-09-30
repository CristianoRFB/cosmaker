import { z } from 'zod';

export const measurementProfileInputSchema = z.object({ name: z.string().trim().min(1).max(100) });
export const measurementInputSchema = z.object({
  type: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(100),
  value: z.coerce.number().finite().min(0).max(100000),
  unit: z.string().trim().min(1).max(20),
  notes: z.string().trim().max(500).optional().default(''),
});

export type MeasurementProfileInput = z.infer<typeof measurementProfileInputSchema>;
export type MeasurementInput = z.infer<typeof measurementInputSchema>;
