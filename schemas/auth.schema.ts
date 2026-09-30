import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
});

export const registrationSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(100, 'Use até 100 caracteres.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
  confirmPassword: z.string().min(1, 'Confirme sua senha.'),
}).refine((value) => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não coincidem.' });

export const passwordResetSchema = z.object({ email: z.string().trim().email('Informe um e-mail válido.') });
