import { z } from 'zod';

const optionalAmount = z.string().trim().optional().refine((value) => !value || (Number.isFinite(Number(value)) && Number(value) >= 0), 'Informe um valor igual ou maior que zero.');

export const quoteRequestSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(100, 'Use até 100 caracteres.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  phone: z.string().trim().max(30, 'Use até 30 caracteres.').optional(),
  character: z.string().trim().min(2, 'Informe o personagem.').max(120, 'Use até 120 caracteres.'),
  franchise: z.string().trim().min(2, 'Informe a obra ou franquia.').max(120, 'Use até 120 caracteres.'),
  category: z.enum(['full_cosplay', 'wig', 'armor', 'prop', 'accessory', 'other'], { error: 'Selecione uma categoria.' }),
  description: z.string().trim().min(20, 'Conte um pouco mais sobre o projeto (mínimo 20 caracteres).').max(2000, 'Use até 2.000 caracteres.'),
  eventDate: z.string().optional(),
  desiredDeliveryDate: z.string().min(1, 'Informe quando gostaria de receber o projeto.'),
  budgetMin: optionalAmount,
  budgetMax: optionalAmount,
  urgency: z.enum(['normal', 'urgent'], { error: 'Selecione o nível de urgência.' }),
  observations: z.string().trim().max(1000, 'Use até 1.000 caracteres.').optional(),
}).superRefine((value, context) => {
  if (value.budgetMin && value.budgetMax && Number(value.budgetMin) > Number(value.budgetMax)) {
    context.addIssue({ code: 'custom', path: ['budgetMax'], message: 'O valor máximo precisa ser maior que o mínimo.' });
  }
  if (value.eventDate && value.desiredDeliveryDate && value.eventDate < value.desiredDeliveryDate) {
    context.addIssue({ code: 'custom', path: ['eventDate'], message: 'A data do evento precisa ser igual ou posterior à data de entrega.' });
  }
});

export type QuoteRequestFormData = z.infer<typeof quoteRequestSchema>;
