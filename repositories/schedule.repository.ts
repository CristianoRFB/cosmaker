import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { MemberCapacityInput, ProductionSlotInput, ScheduleBlockInput } from '@/schemas/schedule.schema';
import type { ScheduleWorkspace } from '@/types/schedule';

function functionsClient() { return requireFirebase().functions; }

export async function listScheduleWorkspace(input: { fromDate: string; toDate: string }) {
  const call = httpsCallable<typeof input, ScheduleWorkspace>(functionsClient(), 'listScheduleWorkspace');
  return (await call(input)).data;
}

export async function saveMemberScheduleCapacity(input: MemberCapacityInput) {
  const call = httpsCallable<MemberCapacityInput, { memberId: string; weeklyHours: number }>(functionsClient(), 'saveMemberScheduleCapacity');
  return (await call(input)).data;
}

export async function allocateProductionTime(input: ProductionSlotInput) {
  const call = httpsCallable<ProductionSlotInput, { slotId: string; date: string; status: 'scheduled'; alreadyCreated: boolean }>(functionsClient(), 'allocateProductionTime');
  return (await call(input)).data;
}

export async function cancelProductionSlot(slotId: string) {
  const call = httpsCallable<{ slotId: string }, { slotId: string; status: 'cancelled' }>(functionsClient(), 'cancelProductionSlot');
  return (await call({ slotId })).data;
}

export async function createScheduleBlock(input: ScheduleBlockInput) {
  const call = httpsCallable<ScheduleBlockInput, { groupId: string; dates: string[]; status: 'active'; alreadyCreated: boolean }>(functionsClient(), 'createScheduleBlock');
  return (await call(input)).data;
}

export async function cancelScheduleBlock(groupId: string) {
  const call = httpsCallable<{ groupId: string }, { groupId: string; status: 'cancelled' }>(functionsClient(), 'cancelScheduleBlock');
  return (await call({ groupId })).data;
}
