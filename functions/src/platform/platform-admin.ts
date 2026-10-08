import type { DocumentData } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { hasPlatformAdminAccess } from './access-policy';
export { hasPlatformAdminAccess } from './access-policy';

export async function requirePlatformAdmin(uid: string, claims: Record<string, unknown>) {
  const profileSnapshot = await adminDb.doc(`users/${uid}`).get();
  if (!hasPlatformAdminAccess(claims, profileSnapshot.data())) {
    throw new HttpsError('permission-denied', 'Acesso restrito à administração da plataforma.');
  }
}

export function isoDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return value ?? null;
}

export function publicAtelierSnapshot(id: string, data: DocumentData) {
  return {
    id,
    name: typeof data.name === 'string' ? data.name : 'Ateliê sem nome',
    slug: typeof data.slug === 'string' ? data.slug : null,
    email: typeof data.email === 'string' ? data.email : null,
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : null,
    plan: typeof data.plan === 'string' ? data.plan : null,
    active: data.active === true,
    demoWorkspace: data.demoWorkspace === true,
    createdAt: isoDate(data.createdAt),
    updatedAt: isoDate(data.updatedAt),
    city: typeof data.city === 'string' ? data.city : null,
    state: typeof data.state === 'string' ? data.state : null,
  };
}
