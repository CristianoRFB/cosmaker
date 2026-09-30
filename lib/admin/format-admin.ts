const actionLabels: Record<string, string> = {
  'platform.atelier_suspended': 'Ateliê suspenso pela plataforma',
  'platform.atelier_reactivated': 'Ateliê reativado pela plataforma',
  'quote.draft_created': 'Rascunho de orçamento criado',
  'quote.sent_to_client_portal': 'Orçamento enviado ao cliente',
  'quote.client_approved': 'Orçamento aprovado pelo cliente',
  'quote.client_rejected': 'Orçamento recusado pelo cliente',
  'quote.client_adjustment_requested': 'Alteração de orçamento solicitada',
  'order.created_from_approved_quote': 'Pedido criado a partir de orçamento aprovado',
};

export function formatPlatformAction(action: string) {
  return actionLabels[action] ?? action.replace(/[._]/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

export function formatPlatformDate(value: string | null) {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function getAtelierStatus(active: boolean) {
  return active ? { label: 'Ativo', tone: 'green' as const } : { label: 'Suspenso', tone: 'red' as const };
}
