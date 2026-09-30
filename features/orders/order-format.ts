import type { OrderStatus } from '@/types/order';

export const orderStatusLabel: Record<OrderStatus, string> = {
  requested: 'Solicitado', quoted: 'Orçado', waiting_deposit: 'Aguardando sinal', confirmed: 'Confirmado',
  waiting_materials: 'Aguardando materiais', scheduled: 'Agendado', modeling: 'Modelagem',
  in_production: 'Em produção', fitting: 'Prova e ajustes', adjustments: 'Ajustes', finishing: 'Finalização',
  waiting_final_payment: 'Aguardando pagamento final', ready_to_ship: 'Pronto para envio', shipped: 'Enviado',
  delivered: 'Entregue', completed: 'Concluído', paused: 'Pausado', cancelled: 'Cancelado', refunded: 'Reembolsado',
};

export function formatOrderMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatOrderDate(value: string | undefined) {
  if (!value) return 'Não definido';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Não definido' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
}

export function formatOrderTimestamp(value: unknown) {
  if (!value || typeof value !== 'object' || !('toDate' in value) || typeof value.toDate !== 'function') return 'Data indisponível';
  const date = value.toDate();
  return date instanceof Date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : 'Data indisponível';
}
