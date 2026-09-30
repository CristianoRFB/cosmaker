export type PaymentType = 'deposit' | 'installment' | 'final' | 'refund';
export type PaymentStatus = 'pending' | 'generated' | 'paid' | 'overdue' | 'cancelled' | 'refunded';

export interface Payment {
  id: string;
  type: PaymentType;
  amount: number;
  method?: 'pix' | 'bank_transfer' | 'cash' | 'card' | 'other' | null;
  status: PaymentStatus;
  dueDate?: string | null;
  paidAt?: unknown;
  reference?: string | null;
  createdAt: unknown;
}
