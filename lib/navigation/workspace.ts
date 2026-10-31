import type { AccountType } from '@/types/user';

export type WorkspaceAudience = 'client' | 'atelier' | 'admin';
export interface WorkspaceItem {
  href: string;
  label: string;
  description: string;
  group: string;
  permissions?: string[];
}

const client: WorkspaceItem[] = [
  { href: '/cliente', label: 'Início', description: 'Encontre os caminhos para acompanhar seu atendimento.', group: 'Acompanhamento' },
  { href: '/cliente/pedidos', label: 'Meus pedidos', description: 'Consulte seus pedidos e acompanhe cada projeto.', group: 'Acompanhamento' },
  { href: '/cliente/orcamentos', label: 'Orçamentos', description: 'Consulte propostas e confira as condições do seu projeto.', group: 'Acompanhamento' },
  { href: '/cliente/medidas', label: 'Minhas medidas', description: 'Consulte e mantenha suas medidas para os projetos.', group: 'Minha conta' },
  { href: '/cliente/pagamentos', label: 'Pagamentos', description: 'Consulte os registros de pagamento do seu atendimento.', group: 'Acompanhamento' },
  { href: '/cliente/mensagens', label: 'Mensagens', description: 'Acesse as conversas com o ateliê.', group: 'Acompanhamento' },
  { href: '/cliente/notificacoes', label: 'Notificações', description: 'Consulte os avisos da sua conta.', group: 'Acompanhamento' },
  { href: '/cliente/perfil', label: 'Meu perfil', description: 'Consulte seus dados de cadastro.', group: 'Minha conta' },
];
const atelier: WorkspaceItem[] = [
  { href: '/atelier', label: 'Visão geral', description: 'Escolha a próxima atividade do ateliê.', group: 'Atendimento' },
  { href: '/atelier/solicitacoes', label: 'Solicitações', description: 'Comece pelos pedidos de orçamento recebidos.', group: 'Atendimento', permissions: ['quotes:read', 'quotes:write'] },
  { href: '/atelier/orcamentos', label: 'Orçamentos', description: 'Prepare e acompanhe as propostas enviadas aos clientes.', group: 'Atendimento', permissions: ['quotes:read', 'quotes:write'] },
  { href: '/atelier/clientes', label: 'Clientes', description: 'Encontre os cadastros e as medidas dos clientes.', group: 'Atendimento', permissions: ['clients:read', 'clients:write'] },
  { href: '/atelier/pedidos', label: 'Pedidos', description: 'Consulte os projetos confirmados e seu histórico.', group: 'Operação', permissions: ['orders:read'] },
  { href: '/atelier/producao', label: 'Produção', description: 'Acompanhe as etapas dos pedidos em produção.', group: 'Operação', permissions: ['orders:read'] },
  { href: '/atelier/agenda', label: 'Agenda e capacidade', description: 'Organize datas, disponibilidade e capacidade de trabalho.', group: 'Operação', permissions: ['schedule:read', 'schedule:write'] },
  { href: '/atelier/estoque', label: 'Estoque', description: 'Consulte materiais e movimentações do ateliê.', group: 'Operação', permissions: ['inventory:read', 'inventory:write'] },
  { href: '/atelier/financeiro', label: 'Financeiro', description: 'Consulte os registros financeiros da operação.', group: 'Gestão', permissions: ['finance:read', 'finance:write'] },
  { href: '/atelier/relatorios', label: 'Relatórios', description: 'Consulte as informações de acompanhamento do ateliê.', group: 'Gestão', permissions: ['orders:read', 'quotes:read', 'finance:read', 'finance:write'] },
  { href: '/atelier/configuracoes', label: 'Configurações', description: 'Encontre as preferências e os controles do ateliê.', group: 'Gestão', permissions: ['atelier:settings'] },
];
const admin: WorkspaceItem[] = [
  { href: '/admin', label: 'Visão geral', description: 'Acompanhe os indicadores e a atividade da plataforma.', group: 'Plataforma' },
  { href: '/admin/ateliers', label: 'Ateliês', description: 'Consulte os ateliês e gerencie sua situação operacional.', group: 'Plataforma' },
  { href: '/admin/planos', label: 'Planos', description: 'Consulte o catálogo e as condições comerciais aprovadas.', group: 'Controle' },
  { href: '/admin/assinaturas', label: 'Assinaturas', description: 'Consulte as atribuições de planos e o status comercial.', group: 'Controle' },
  { href: '/admin/logs', label: 'Auditoria', description: 'Confira o histórico de alterações administrativas.', group: 'Controle' },
];

export function navigationFor(audience: WorkspaceAudience, hasPermission: (permission: string) => boolean = () => false): WorkspaceItem[] {
  if (audience === 'client') return client;
  if (audience === 'admin') return admin;
  return atelier.filter((item) => !item.permissions || item.permissions.some(hasPermission));
}

export function currentSection(items: WorkspaceItem[], pathname: string) {
  return items.filter((item) => pathname === item.href || (!['/cliente', '/atelier', '/admin'].includes(item.href) && pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
export function searchNavigation(items: WorkspaceItem[], query: string) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return items.filter((item) => terms.every((term) => normalize(`${item.label} ${item.description} ${item.group}`).includes(term)));
}

export function accountHome(accountType?: AccountType) {
  return accountType === 'platform_admin' ? '/admin' : accountType === 'atelier_member' ? '/atelier' : '/cliente';
}

export function loginDestination(value: string | null, accountType?: AccountType) {
  const fallback = accountHome(accountType);
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\u0000-\u001f]/.test(decoded)) return fallback;
    const url = new URL(value, 'https://cosmaker.local');
    return url.origin === 'https://cosmaker.local' ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch { return fallback; }
}
