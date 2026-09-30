import { z } from 'zod';

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const quoteItemSchema = z.object({
  description: z.string().trim().min(2, 'Descreva o item.').max(160, 'Use até 160 caracteres.'),
  category: z.enum(['material', 'labor', 'other']),
  quantity: z.number().finite().positive('A quantidade precisa ser maior que zero.'),
  unitPrice: z.number().finite().nonnegative('O preço não pode ser negativo.'),
});

export const quoteDraftSchema = z.object({
  requestId: z.string().min(1),
  items: z.array(quoteItemSchema).min(1, 'Adicione pelo menos um item ao orçamento.').max(100),
  urgencyFee: z.number().finite().nonnegative(),
  shipping: z.number().finite().nonnegative(),
  discount: z.number().finite().nonnegative(),
  validUntil: z.string().refine(isDate, 'Informe uma data válida para a validade do orçamento.'),
  expectedStartDate: z.string().optional().refine((value) => !value || isDate(value), 'Informe uma data válida para o início.'),
  expectedCompletionDate: z.string().optional().refine((value) => !value || isDate(value), 'Informe uma data válida para a conclusão.'),
  depositPercentage: z.number().finite().min(0).max(100),
}).superRefine((value, context) => {
  if (value.expectedStartDate && value.expectedCompletionDate && value.expectedCompletionDate < value.expectedStartDate) {
    context.addIssue({ code: 'custom', path: ['expectedCompletionDate'], message: 'A conclusão precisa ser posterior ao início.' });
  }
  const itemsTotal = value.items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPrice * 100) / 100, 0);
  const subtotal = Math.round((itemsTotal + value.urgencyFee + value.shipping) * 100) / 100;
  if (value.discount > subtotal) {
    context.addIssue({ code: 'custom', path: ['discount'], message: 'O desconto não pode ser maior que o subtotal.' });
  }
});

export type QuoteDraftInput = z.infer<typeof quoteDraftSchema>;
export type QuoteItemInput = z.infer<typeof quoteItemSchema>;
