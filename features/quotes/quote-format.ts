import type { QuoteStatus } from '@/types/quote';
import type { QuoteRequestStatus } from '@/types/quote-request';

export const quoteStatusLabel: Record<QuoteStatus, string> = {
  draft: 'Rascunho', sent: 'Disponível para o cliente', approved: 'Aprovado', rejected: 'Recusado', expired: 'Expirado', superseded: 'Substituído',
};

export const requestStatusLabel: Record<QuoteRequestStatus, string> = {
  new: 'Nova', under_review: 'Em análise', quoted: 'Orçamento disponível', adjustment_requested: 'Ajuste solicitado', approved: 'Aprovada', rejected: 'Recusada', expired: 'Encerrada',
};

export const categoryLabel: Record<string, string> = {
  full_cosplay: 'Cosplay completo', wig: 'Peruca', armor: 'Armadura', prop: 'Prop', accessory: 'Acessório', other: 'Outro',
};

export const itemCategoryLabel = { material: 'Material', labor: 'Mão de obra', other: 'Outro' } as const;

export function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(value?: string) {
  if (!value) return 'Não informado';
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return 'Não informado';
  const [year, month, day] = parts;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'medium' }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatTimestamp(value: unknown) {
  let date: Date | null = value instanceof Date ? value : null;
  if (!date && value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') date = value.toDate();
  return date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : 'Data indisponível';
}
