import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { OrderProductionConfiguration, ProductionConfigurationStage, ProductionStageAction } from '@/types/production';

export async function getOrderProductionConfiguration(atelierId: string, orderId: string) {
  const { functions } = requireFirebase();
  const call = httpsCallable<{ atelierId: string; orderId: string }, OrderProductionConfiguration>(functions, 'getOrderProductionConfiguration');
  return (await call({ atelierId, orderId })).data;
}

export async function saveOrderProductionConfiguration(input: {
  atelierId: string; orderId: string; requestId: string; expectedVersion: number; stages: ProductionConfigurationStage[];
}) {
  const { functions } = requireFirebase();
  const stages = input.stages.map((stage) => ({
    id: stage.id, name: stage.name, progressWeight: stage.progressWeight, requiresClientApproval: stage.requiresClientApproval,
    semanticKey: stage.semanticKey, assignedTo: stage.assignedTo, plannedStartDate: stage.plannedStartDate,
    deadline: stage.deadline, expectedUpdatedAt: stage.expectedUpdatedAt,
  }));
  const call = httpsCallable<typeof input, { orderId: string; version: number; progress: number; replayed: boolean }>(functions, 'saveOrderProductionConfiguration');
  return (await call({ ...input, stages })).data;
}

export async function advanceProductionStage(input: {
  atelierId: string; orderId: string; stageId: string; action: ProductionStageAction;
  progress?: number; note?: string; requestId: string; expectedVersion: number;
}) {
  const { functions } = requireFirebase();
  const call = httpsCallable<typeof input, { orderId: string; stageId: string; status: string; progress: number; version: number; replayed: boolean }>(functions, 'updateProductionStage');
  return (await call(input)).data;
}
