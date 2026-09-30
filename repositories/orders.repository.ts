import { collection, collectionGroup, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { Order, OrderFile, OrderHistoryEntry, OrderLineItem, OrderRecord } from '@/types/order';
import type { Measurement } from '@/types/measurement';
import type { ProductionStageAction } from '@/types/production';

function orderFromSnapshot(snapshot: { id: string; ref: { path: string }; data: () => Record<string, unknown> }, atelierId?: string) {
  const pathParts = snapshot.ref.path.split('/');
  return { id: snapshot.id, atelierId: atelierId ?? pathParts[1], ...snapshot.data() } as Order;
}

export async function listAtelierOrders(atelierId: string) {
  const { db } = requireFirebase();
  const result = await getDocs(query(collection(db, 'ateliers', atelierId, 'orders'), orderBy('updatedAt', 'desc'), limit(100)));
  return result.docs.map((snapshot) => orderFromSnapshot(snapshot, atelierId));
}

export async function listClientOrders(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return [];
  const { db } = requireFirebase();
  const result = await getDocs(query(
    collectionGroup(db, 'orders'),
    where('email', '==', normalizedEmail),
    orderBy('createdAt', 'desc'),
    limit(50),
  ));
  return result.docs.map((snapshot) => orderFromSnapshot(snapshot));
}

export async function getOrder(atelierId: string, orderId: string, viewer: 'atelier' | 'client' = 'atelier'): Promise<OrderRecord | null> {
  const { db, storage } = requireFirebase();
  const orderRef = doc(db, 'ateliers', atelierId, 'orders', orderId);
  const orderSnapshot = await getDoc(orderRef);
  if (!orderSnapshot.exists()) return null;
  const [itemSnapshots, fileSnapshots, historySnapshots, measurementSnapshots] = await Promise.all([
    getDocs(collection(orderRef, 'items')),
    getDocs(collection(orderRef, 'files')),
    getDocs(query(collection(orderRef, 'statusHistory'), orderBy('createdAt', 'asc'))),
    getDocs(collection(orderRef, 'measurementSnapshot')),
  ]);
  const [stageSnapshots, photoSnapshots, approvalSnapshots, paymentSnapshots] = await Promise.all([
    getDocs(query(collection(orderRef, 'productionStages'), orderBy('order', 'asc'))),
    getDocs(viewer === 'client'
      ? query(collection(orderRef, 'photos'), where('visibleToClient', '==', true), where('uploadStatus', '==', 'ready'), orderBy('createdAt', 'asc'))
      : query(collection(orderRef, 'photos'), orderBy('createdAt', 'asc'))),
    getDocs(query(collection(orderRef, 'approvals'), orderBy('requestedAt', 'asc'))),
    getDocs(query(collection(orderRef, 'payments'), orderBy('createdAt', 'asc'))),
  ]);
  const productionPhotos = await Promise.all(photoSnapshots.docs.map(async (snapshot) => {
    const photo = { id: snapshot.id, ...snapshot.data() } as import('@/types/production').ProductionPhoto;
    try { return { ...photo, downloadUrl: await getDownloadURL(ref(storage, photo.storagePath)) }; }
    catch { return { ...photo, downloadUrl: null }; }
  }));
  return {
    order: { id: orderSnapshot.id, atelierId, ...orderSnapshot.data() } as Order,
    items: itemSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as OrderLineItem),
    files: fileSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as OrderFile),
    history: historySnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as OrderHistoryEntry),
    measurements: measurementSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as Measurement),
    productionStages: stageSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as import('@/types/production').ProductionStage),
    productionPhotos,
    approvals: approvalSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as import('@/types/production').ProductionApproval),
    payments: paymentSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as import('@/types/payment').Payment),
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
  const { functions, storage } = requireFirebase();
  const create = httpsCallable<{
    atelierId: string; orderId: string; stageId: string; originalName: string; contentType: string; caption: string; visibleToClient: boolean;
  }, { photoId: string; storagePath: string }>(functions, 'createProductionPhotoUpload');
  const request = await create({
    atelierId: input.atelierId, orderId: input.orderId, stageId: input.stageId,
    originalName: input.file.name, contentType: input.file.type,
    caption: input.caption, visibleToClient: input.visibleToClient,
  });
  await uploadBytes(ref(storage, request.data.storagePath), input.file, {
    contentType: input.file.type,
    customMetadata: { photoId: request.data.photoId, orderId: input.orderId },
  });
  const complete = httpsCallable<{ atelierId: string; orderId: string; photoId: string }, { photoId: string; status: 'ready' }>(functions, 'completeProductionPhotoUpload');
  return (await complete({ atelierId: input.atelierId, orderId: input.orderId, photoId: request.data.photoId })).data;
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
