import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, where, type QueryConstraint } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { Order, OrderFile, OrderHistoryEntry, OrderLineItem, OrderRecord } from '@/types/order';
import type { Measurement } from '@/types/measurement';
import type { ProductionStageAction } from '@/types/production';
import { authenticatedFileRequest, listOrderFiles } from './order-files.repository';

function orderFromSnapshot(snapshot: { id: string; ref: { path: string }; data: () => Record<string, unknown> }, atelierId?: string) {
  const pathParts = snapshot.ref.path.split('/');
  return { id: snapshot.id, atelierId: atelierId ?? pathParts[1], ...snapshot.data() } as Order;
}

export async function listAtelierOrders(atelierId: string) {
  const { db } = requireFirebase();
  const result = await getDocs(query(collection(db, 'ateliers', atelierId, 'orders'), orderBy('updatedAt', 'desc'), limit(100)));
  return result.docs.map((snapshot) => orderFromSnapshot(snapshot, atelierId));
}

export async function listOrderStatusHistory(atelierId: string, orderId: string, cursor?: string) {
  const { db } = requireFirebase();
  const history = collection(db, 'ateliers', atelierId, 'orders', orderId, 'statusHistory');
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc'), limit(51)];
  if (cursor) {
    const last = await getDoc(doc(history, cursor));
    if (!last.exists()) throw new Error('A página do histórico expirou. Atualize o pedido.');
    constraints.push(startAfter(last));
  }
  const snapshot = await getDocs(query(history, ...constraints));
  const entries = snapshot.docs.slice(0, 50).map((document) => ({ id: document.id, ...document.data() }) as OrderHistoryEntry);
  return { entries, nextCursor: snapshot.size > 50 ? entries.at(-1)?.id ?? null : null };
}

export async function listClientOrdersPage(cursor?: string) {
  const { functions } = requireFirebase();
  return (await httpsCallable<{ cursor?: string }, { orders: Order[]; hasMore: boolean; nextCursor: string | null }>(functions, 'listClientOrders')(cursor ? { cursor } : {})).data;
}
export async function listClientOrders(email: string) {
  if (!email.trim()) return [];
  return (await listClientOrdersPage()).orders;
}

export async function getOrder(atelierId: string, orderId: string, viewer: 'atelier' | 'client' = 'atelier', includePayments = true): Promise<OrderRecord | null> {
  const { db } = requireFirebase();
  const orderRef = doc(db, 'ateliers', atelierId, 'orders', orderId);
  let order: Order;
  if (viewer === 'client') {
    const { functions } = requireFirebase();
    order = (await httpsCallable<{ atelierId: string; orderId: string }, { order: Order }>(functions, 'getClientOrder')({ atelierId, orderId })).data.order;
  } else {
    const snapshot = await getDoc(orderRef);
    if (!snapshot.exists()) return null;
    order = { id: snapshot.id, atelierId, ...snapshot.data() } as Order;
  }
  const [itemSnapshots, fileSnapshots, historySnapshots, measurementSnapshots] = await Promise.all([
    getDocs(collection(orderRef, 'items')),
    viewer === 'client' ? listOrderFiles(atelierId, orderId) : getDocs(collection(orderRef, 'files')),
    getDocs(query(collection(orderRef, 'statusHistory'), orderBy('createdAt', 'asc'))),
    getDocs(collection(orderRef, 'measurementSnapshot')),
  ]);
  const [stageSnapshots, photoSnapshots, approvalSnapshots, paymentSnapshots] = await Promise.all([
    getDocs(query(collection(orderRef, 'productionStages'), orderBy('order', 'asc'))),
    getDocs(viewer === 'client'
      ? query(collection(orderRef, 'photos'), where('visibleToClient', '==', true), where('uploadStatus', '==', 'ready'), orderBy('createdAt', 'asc'))
      : query(collection(orderRef, 'photos'), orderBy('createdAt', 'asc'))),
    getDocs(query(collection(orderRef, 'approvals'), orderBy('requestedAt', 'asc'))),
    includePayments && viewer !== 'client' ? getDocs(query(collection(orderRef, 'payments'), orderBy('createdAt', 'asc'))) : Promise.resolve(null),
  ]);
  const productionPhotos = photoSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data(), downloadUrl: null }) as import('@/types/production').ProductionPhoto);
  return {
    order,
    items: itemSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as OrderLineItem),
    files: Array.isArray(fileSnapshots) ? fileSnapshots : fileSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as OrderFile),
    history: historySnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as OrderHistoryEntry),
    measurements: measurementSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as Measurement),
    productionStages: stageSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as import('@/types/production').ProductionStage),
    productionPhotos,
    approvals: approvalSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as import('@/types/production').ProductionApproval),
    payments: paymentSnapshots?.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as import('@/types/payment').Payment) ?? [],
  };
}

export async function confirmOrderDeposit(atelierId: string, orderId: string, method: 'pix' | 'bank_transfer' | 'cash' | 'other', reference: string) {
  const { functions } = requireFirebase();
  const call = httpsCallable<{ atelierId: string; orderId: string; method: string; reference: string }, { orderId: string; status: 'confirmed'; alreadyConfirmed: boolean }>(functions, 'confirmOrderDeposit');
  return (await call({ atelierId, orderId, method, reference })).data;
}

export async function updateProductionStage(input: {
  atelierId: string; orderId: string; stageId: string; action: ProductionStageAction; progress?: number; note?: string;
}) {
  const { functions } = requireFirebase();
  const call = httpsCallable<typeof input, { orderId: string; stageId: string; status: string; progress: number }>(functions, 'updateProductionStage');
  return (await call(input)).data;
}

export async function respondToProductionApproval(input: {
  atelierId: string; orderId: string; approvalId: string; decision: 'approved' | 'changes_requested'; comment: string;
}) {
  const { functions } = requireFirebase();
  const call = httpsCallable<typeof input, { orderId: string; approvalId: string; status: string; progress: number }>(functions, 'respondToProductionApproval');
  return (await call(input)).data;
}

export async function uploadProductionPhoto(input: {
  atelierId: string; orderId: string; stageId: string; file: File; caption: string; visibleToClient: boolean;
}) {
  const { functions } = requireFirebase();
  const create = httpsCallable<{
    atelierId: string; orderId: string; stageId: string; originalName: string; contentType: string; caption: string; visibleToClient: boolean;
  }, { photoId: string; storagePath: string }>(functions, 'createProductionPhotoUpload');
  const request = await create({
    atelierId: input.atelierId, orderId: input.orderId, stageId: input.stageId,
    originalName: input.file.name, contentType: input.file.type,
    caption: input.caption, visibleToClient: input.visibleToClient,
  });
  const response = await authenticatedFileRequest('uploadProductionPhotoBytes', input.atelierId, input.orderId, request.data.photoId, {
    method: 'POST', body: input.file, headers: { 'Content-Type': input.file.type },
  }, 'photoId');
  return response.json() as Promise<{ photoId: string; status: 'ready'; alreadyApplied: boolean }>;
}

export async function getProductionBoard(atelierId: string) {
  const { functions } = requireFirebase();
  const call = httpsCallable<{ atelierId: string }, { stages: Array<{
    id: string; atelierId: string; orderId: string; name: string; order: number; status: string;
    progress: number; progressWeight: number; requiresClientApproval: boolean; pendingApprovalId: string | null;
    notes: string | null; character: string; clientName: string; expectedDeliveryDate: string;
    priority: Order['priority']; orderStatus: Order['status']; orderProgress: number;
  }> }>(functions, 'listProductionBoard');
  return (await call({ atelierId })).data.stages;
}

export async function finalizeOrder(input: { orderId: string; action: 'deliver' | 'complete'; note: string; method?: 'pickup' | 'shipping'; requestId: string; expectedVersion: number }) {
  const { functions } = requireFirebase();
  return (await httpsCallable<typeof input, { orderId: string; status: 'delivered' | 'completed'; version: number; alreadyApplied: boolean }>(functions, 'finalizeOrder')(input)).data;
}
