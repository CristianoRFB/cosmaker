import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { InventoryMaterial, InventoryMovement, InventoryReservation, InventorySupplier, InventoryWorkspace } from '@/types/inventory';
import type { InventoryMovementInput, MaterialInput, SupplierInput } from '@/schemas/material.schema';

function functionsClient() {
  return requireFirebase().functions;
}

export async function listInventoryWorkspace() {
  const call = httpsCallable<Record<string, never>, InventoryWorkspace>(functionsClient(), 'listInventoryWorkspace');
  return (await call({})).data;
}

export async function listInventoryMovements(input: { materialId?: string; orderId?: string; cursor?: string | null } = {}) {
  const call = httpsCallable<typeof input, { movements: InventoryMovement[]; nextCursor: string | null }>(functionsClient(), 'listInventoryMovements');
  return (await call(input)).data;
}

export async function saveInventoryMaterial(input: MaterialInput, materialId?: string, requestId = crypto.randomUUID()) {
  const payload = { ...input, requestId, ...(materialId ? { materialId } : {}) };
  const call = httpsCallable<typeof payload, { materialId: string; alreadyApplied: boolean }>(functionsClient(), 'saveInventoryMaterial');
  return (await call(payload)).data;
}

export async function saveInventorySupplier(input: SupplierInput, supplierId?: string, requestId = crypto.randomUUID()) {
  const payload = { ...input, requestId, ...(supplierId ? { supplierId } : {}) };
  const call = httpsCallable<typeof payload, { supplierId: string; alreadyApplied: boolean }>(functionsClient(), 'saveInventorySupplier');
  return (await call(payload)).data;
}

export async function applyInventoryMovement(input: InventoryMovementInput, requestId = crypto.randomUUID()) {
  const payload = {
    requestId,
    materialId: input.materialId,
    kind: input.kind,
    quantity: input.quantity,
    ...(input.orderId ? { orderId: input.orderId } : {}),
    ...(input.reservationId ? { reservationId: input.reservationId } : {}),
    ...(input.plannedQuantity !== undefined ? { plannedQuantity: input.plannedQuantity } : {}),
  };
  const call = httpsCallable<typeof payload, { movementId: string; reservationId: string | null; alreadyApplied: boolean }>(functionsClient(), 'applyInventoryMovement');
  return (await call(payload)).data;
}

export type { InventoryMaterial, InventoryMovement, InventoryReservation, InventorySupplier, InventoryWorkspace };
