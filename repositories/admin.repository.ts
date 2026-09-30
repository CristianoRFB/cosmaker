'use client';

import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';

export interface PlatformAtelier {
  id: string;
  name: string;
  slug: string | null;
  email: string | null;
  ownerId: string | null;
  plan: string | null;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  city: string | null;
  state: string | null;
}

export interface PlatformActivity {
  id: string;
  actorId: string;
  atelierId: string | null;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string | null;
}

export interface PlatformOverview {
  totals: {
    ateliers: number;
    activeAteliers: number;
    suspendedAteliers: number;
    users: number;
    activeSubscriptions: number;
  };
  recentActivity: PlatformActivity[];
}

export interface PlatformAtelierDetail {
  atelier: PlatformAtelier & { description: string | null; phone: string | null };
  owner: { id: string; name: string | null; email: string | null } | null;
  counts: { members: number; clients: number; orders: number; quoteRequests: number };
  subscription: { id: string; status: string | null; plan: string | null; currentPeriodEnd: string | null } | null;
}

export interface PlatformAuditEntry extends PlatformActivity {
  before: unknown;
  after: unknown;
}

function functionsClient() {
  return requireFirebase().functions;
}

export async function getPlatformOverview() {
  const call = httpsCallable<void, PlatformOverview>(functionsClient(), 'getPlatformOverview');
  return (await call()).data;
}

export async function listPlatformAteliers(cursor: string | null = null) {
  const call = httpsCallable<{ cursor?: string; limit: number }, { ateliers: PlatformAtelier[]; nextCursor: string | null }>(functionsClient(), 'listPlatformAteliers');
  return (await call({ ...(cursor ? { cursor } : {}), limit: 25 })).data;
}

export async function getPlatformAtelier(atelierId: string) {
  const call = httpsCallable<{ atelierId: string }, PlatformAtelierDetail>(functionsClient(), 'getPlatformAtelier');
  return (await call({ atelierId })).data;
}

export async function setPlatformAtelierStatus(atelierId: string, active: boolean) {
  const call = httpsCallable<{ atelierId: string; active: boolean }, { atelierId: string; active: boolean }>(functionsClient(), 'setPlatformAtelierStatus');
  return (await call({ atelierId, active })).data;
}

export async function listPlatformAuditLogs(cursor: string | null = null) {
  const call = httpsCallable<{ cursor?: string; limit: number }, { entries: PlatformAuditEntry[]; nextCursor: string | null }>(functionsClient(), 'listPlatformAuditLogs');
  return (await call({ ...(cursor ? { cursor } : {}), limit: 25 })).data;
}
