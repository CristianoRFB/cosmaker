import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { ConversationSummary, OrderConversation } from '@/types/conversation';
export async function listMessageInbox() { return (await httpsCallable<Record<string, never>, { conversations: ConversationSummary[]; legacyCount: number }>(requireFirebase().functions, 'listMessageInbox')({})).data; }
export async function getOrderConversation(atelierId: string, orderId: string, beforeSequence?: number) {
  return (await httpsCallable<Record<string, unknown>, OrderConversation>(requireFirebase().functions, 'getOrderConversation')({ atelierId, orderId, ...(beforeSequence === undefined ? {} : { beforeSequence }) })).data;
}
export async function sendOrderMessage(atelierId: string, orderId: string, text: string, attachmentIds: string[], requestId: string) {
  return (await httpsCallable<Record<string, unknown>, { sequence: number; alreadyApplied: boolean }>(requireFirebase().functions, 'sendOrderMessage')({ atelierId, orderId, text, attachmentIds, requestId })).data;
}
export async function markOrderConversationRead(atelierId: string, orderId: string, sequence: number) {
  return (await httpsCallable(requireFirebase().functions, 'markOrderConversationRead')({ atelierId, orderId, sequence })).data;
}
