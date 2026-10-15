import { z } from 'zod';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,150}$/, 'Identificador inválido.');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Informe uma data válida.');
const version = z.number().int().nonnegative().refine(Number.isSafeInteger);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const cents = z.number().int().refine(Number.isSafeInteger, 'Informe centavos inteiros.');

export const orderChangeTermsSchema = z.object({
  scope: z.string().trim().min(5).max(3000).optional(),
  materials: z.string().trim().min(1).max(1500).optional(),
  expectedDeliveryDate: date.optional(),
  valueDeltaCents: cents.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Informe ao menos uma condição alterada.');

export const proposeOrderChangeSchema = z.object({
  atelierId: id, orderId: id, requestId: id, baseAgreementVersion: version, baseAgreementFingerprint: hash,
  reason: z.string().trim().min(5, 'Explique o motivo da revisão.').max(1000),
  changes: orderChangeTermsSchema, supersedesId: id.optional(),
}).strict();

export const respondOrderChangeSchema = z.object({
  atelierId: id, orderId: id, changeRequestId: id, requestId: id, version, proposalFingerprint: hash,
  decision: z.enum(['approved', 'rejected', 'changes_requested']), comment: z.string().trim().max(1000), confirmed: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.decision === 'approved' && !value.confirmed) context.addIssue({ code: 'custom', path: ['confirmed'], message: 'Confirme explicitamente as condições da revisão.' });
  if (value.decision !== 'approved' && value.comment.length < 5) context.addIssue({ code: 'custom', path: ['comment'], message: 'Descreva o motivo ou ajuste em ao menos cinco caracteres.' });
});

export const applyOrderChangeSchema = z.object({
  atelierId: id, orderId: id, changeRequestId: id, requestId: id, version, proposalFingerprint: hash,
}).strict();

export const cancelOrderChangeSchema = z.object({
  atelierId: id, orderId: id, changeRequestId: id, requestId: id, reason: z.string().trim().min(5).max(1000),
}).strict();

export type ProposeOrderChangeInput = z.infer<typeof proposeOrderChangeSchema>;
export type RespondOrderChangeInput = z.infer<typeof respondOrderChangeSchema>;
export type ApplyOrderChangeInput = z.infer<typeof applyOrderChangeSchema>;
export type CancelOrderChangeInput = z.infer<typeof cancelOrderChangeSchema>;
