import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { FinanceEntryInput, FinanceFilters, FinanceWorkspaceData } from '@/types/finance';

export async function listFinanceWorkspace(filters: FinanceFilters = {}) {
  return (await httpsCallable<FinanceFilters, FinanceWorkspaceData>(requireFirebase().functions, 'listFinanceWorkspace')(filters)).data;
}
export async function recordFinanceEntry(input: FinanceEntryInput, requestId: string) {
  return (await httpsCallable<FinanceEntryInput & { requestId: string }, { entryId: string; alreadyApplied: boolean }>(requireFirebase().functions, 'recordFinanceEntry')({ ...input, requestId })).data;
}
export async function reverseFinanceEntry(input: { entryId: string; reason: string; effectiveDate: string }, requestId: string) {
  return (await httpsCallable<typeof input & { requestId: string }, { entryId: string; alreadyApplied: boolean }>(requireFirebase().functions, 'reverseFinanceEntry')({ ...input, requestId })).data;
}
export async function reconcileLegacyFinancePayment(orderId: string, paymentId: string, requestId: string) {
  return (await httpsCallable<{ orderId: string; paymentId: string; requestId: string }, { entryId: string; alreadyApplied: boolean }>(requireFirebase().functions, 'reconcileLegacyFinancePayment')({ orderId, paymentId, requestId })).data;
}
