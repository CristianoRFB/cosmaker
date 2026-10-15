import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';
import { applyOrderChangeSchema, cancelOrderChangeSchema, proposeOrderChangeSchema, respondOrderChangeSchema, type ApplyOrderChangeInput, type CancelOrderChangeInput, type ProposeOrderChangeInput, type RespondOrderChangeInput } from '@/schemas/order-change.schema';
import type { OrderChangeRequestPage, OrderChangeStatus } from '@/types/order-change';

interface ChangeResult { changeRequestId: string; status: OrderChangeStatus; alreadyApplied: boolean; version?: number; agreementVersion?: number }

export async function listOrderChangeRequests(atelierId: string, orderId: string, cursor?: string): Promise<OrderChangeRequestPage> {
  const { functions } = requireFirebase();
  const call = httpsCallable<{ atelierId: string; orderId: string; cursor?: string }, OrderChangeRequestPage>(functions, 'listOrderChangeRequests');
  return (await call({ atelierId, orderId, ...(cursor ? { cursor } : {}) })).data;
}

async function mutate<T>(name: string, input: T) {
  const { functions } = requireFirebase();
  return (await httpsCallable<T, ChangeResult>(functions, name)(input)).data;
}

export function proposeOrderChangeRequest(input: ProposeOrderChangeInput) {
  return mutate('proposeOrderChangeRequest', proposeOrderChangeSchema.parse(input));
}

export function respondToOrderChangeRequest(input: RespondOrderChangeInput) {
  return mutate('respondToOrderChangeRequest', respondOrderChangeSchema.parse(input));
}

export function applyOrderChangeRequest(input: ApplyOrderChangeInput) {
  return mutate('applyOrderChangeRequest', applyOrderChangeSchema.parse(input));
}

export function cancelOrderChangeRequest(input: CancelOrderChangeInput) {
  return mutate('cancelOrderChangeRequest', cancelOrderChangeSchema.parse(input));
}
