import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const memberId = z.string().trim().min(1).max(150).refine((value) => !value.includes('/'));

export const memberCapacitySchema = z.object({
  memberId,
  weeklyHoursByWeekday: z.record(z.string(), z.number().min(0).max(16).multipleOf(0.25))
    .refine((hours) => Object.keys(hours).every((day) => /^[0-6]$/.test(day))),
  workdayStartMinute: z.number().int().min(0).max(1439),
  workdayEndMinute: z.number().int().min(1).max(1440),
  timezone: z.string().min(1).max(80),
}).refine((value) => value.workdayEndMinute > value.workdayStartMinute, {
  message: 'O fim do expediente precisa ser posterior ao início.', path: ['workdayEndMinute'],
}).refine((value) => Object.values(value.weeklyHoursByWeekday).every((hours) => hours <= (value.workdayEndMinute - value.workdayStartMinute) / 60), {
  message: 'As horas diárias não podem exceder a duração do expediente.', path: ['weeklyHoursByWeekday'],
});

export const productionSlotSchema = z.object({
  requestId: z.string().trim().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  orderId: memberId,
  stageId: memberId,
  assignedTo: memberId,
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  plannedHours: z.number().min(0.25).max(16).multipleOf(0.25),
  deadline: date.nullable().optional(),
});

export const scheduleBlockSchema = z.object({
  requestId: z.string().trim().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  memberId,
  startDate: date,
  endDate: date,
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  allDay: z.boolean(),
  type: z.enum(['pause', 'leave', 'vacation', 'other']),
  title: z.string().trim().min(2).max(100),
}).refine((value) => value.startDate <= value.endDate, {
  message: 'A data final precisa ser igual ou posterior à inicial.', path: ['endDate'],
}).refine((value) => value.endDate !== value.startDate ? value.allDay : value.endMinute > value.startMinute, {
  message: 'Bloqueios de vários dias precisam ocupar dias inteiros.', path: ['allDay'],
});

export type MemberCapacityInput = z.infer<typeof memberCapacitySchema>;
export type ProductionSlotInput = z.infer<typeof productionSlotSchema>;
export type ScheduleBlockInput = z.infer<typeof scheduleBlockSchema>;
