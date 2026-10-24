import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { Payment } from '@/types/payment';

export interface ClientPayment extends Omit<Payment, 'reference' | 'createdAt' | 'paidAt'> {
  amountCents: number;
  createdAt: string | null;
  paidAt: string | null;
  reversedAt: string | null;
  effectiveDate: string | null;
}
export interface ClientPaymentsPage {
  order: { id: string; atelierId: string; character: string; revenueCents: number; receivedCents: number; remainingCents: number };
  payments: ClientPayment[];
  nextCursor: string | null;
}
export async function listClientOrderPayments(atelierId: string, orderId: string, cursor?: string) {
  return (await httpsCallable<Record<string, unknown>, ClientPaymentsPage>(requireFirebase().functions, 'listClientOrderPayments')({ atelierId, orderId, ...(cursor ? { cursor } : {}) })).data;
}
export async function getClientPayment(atelierId: string, orderId: string, paymentId: string) {
  return (await httpsCallable<Record<string, unknown>, ClientPaymentsPage>(requireFirebase().functions, 'getClientPayment')({ atelierId, orderId, paymentId })).data;
}
