import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { Notification } from '@/types/notification';
export async function listInternalNotifications(cursor?: string) { return (await httpsCallable<Record<string, unknown>, { notifications: Notification[]; nextCursor: string | null }>(requireFirebase().functions, 'listInternalNotifications')({ ...(cursor ? { cursor } : {}) })).data; }
export async function markInternalNotificationRead(atelierId: string, notificationId: string) { return (await httpsCallable(requireFirebase().functions, 'markInternalNotificationRead')({ atelierId, notificationId })).data; }
