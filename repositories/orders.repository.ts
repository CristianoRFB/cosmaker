import { collection, collectionGroup, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { Order, OrderFile, OrderHistoryEntry, OrderLineItem, OrderRecord } from '@/types/order';
import type { Measurement } from '@/types/measurement';

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

export async function getOrder(atelierId: string, orderId: string): Promise<OrderRecord | null> {
  const { db } = requireFirebase();
  const orderRef = doc(db, 'ateliers', atelierId, 'orders', orderId);
  const orderSnapshot = await getDoc(orderRef);
  if (!orderSnapshot.exists()) return null;
  const [itemSnapshots, fileSnapshots, historySnapshots, measurementSnapshots] = await Promise.all([
    getDocs(collection(orderRef, 'items')),
    getDocs(collection(orderRef, 'files')),
    getDocs(query(collection(orderRef, 'statusHistory'), orderBy('createdAt', 'asc'))),
    getDocs(collection(orderRef, 'measurementSnapshot')),
  ]);
  return {
    order: { id: orderSnapshot.id, atelierId, ...orderSnapshot.data() } as Order,
    items: itemSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as OrderLineItem),
    files: fileSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as OrderFile),
    history: historySnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as OrderHistoryEntry),
    measurements: measurementSnapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as Measurement),
  };
}
