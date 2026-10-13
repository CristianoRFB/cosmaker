import type { AtelierRole } from '@/types/user';
import type { AtelierPermission } from '@/lib/permissions/roles';

export const teamRoleLabel: Record<AtelierRole, string> = {
  owner: 'Titular',
  admin: 'Administrador',
  cosmaker: 'Cosmaker',
  assistant: 'Assistente',
  finance: 'Financeiro',
};

export const teamPermissionLabel: Record<AtelierPermission, string> = {
  'atelier:settings': 'Configurações do ateliê',
  'team:read': 'Consultar equipe',
  'team:manage': 'Gerenciar equipe',
  'clients:read': 'Consultar clientes',
  'clients:write': 'Cadastrar e editar clientes',
  'clients:delete': 'Excluir clientes',
  'quotes:read': 'Consultar solicitações e propostas',
  'quotes:write': 'Criar e alterar propostas',
  'orders:read': 'Consultar pedidos',
  'orders:manage': 'Gerenciar pedidos e produção',
  'payments:write': 'Confirmar pagamentos internos',
  'measurements:read': 'Consultar medidas',
  'measurements:write': 'Registrar medidas',
  'portfolio:manage': 'Gerenciar portfólio',
  'finance:read': 'Consultar financeiro',
  'finance:write': 'Registrar financeiro',
  'inventory:read': 'Consultar estoque',
  'inventory:write': 'Gerenciar estoque',
  'schedule:read': 'Consultar agenda',
  'schedule:write': 'Gerenciar agenda',
  'services:read': 'Consultar serviços',
  'services:write': 'Gerenciar serviços',
  'events:read': 'Consultar eventos',
  'events:write': 'Gerenciar eventos',
};
