import { z } from 'zod';
import { atelierPermissionCatalog } from '@/lib/permissions/roles';

const permissionSet = new Set<string>(atelierPermissionCatalog);
const permissionsSchema = z.array(z.string().refine((value) => permissionSet.has(value), 'Permissão inválida.'))
  .max(atelierPermissionCatalog.length)
  .refine((value) => new Set(value).size === value.length, 'Permissões duplicadas.');
const roleSchema = z.enum(['admin', 'cosmaker', 'assistant', 'finance']);

export const teamInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.').max(254),
  role: roleSchema,
  permissions: permissionsSchema,
});

export const teamMemberUpdateSchema = z.object({
  memberId: z.string().min(1).max(150).refine((value) => !value.includes('/')),
  role: roleSchema,
  permissions: permissionsSchema,
  active: z.boolean(),
});
