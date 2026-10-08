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
  demoWorkspace: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  city: string | null;
  state: string | null;
  commercial: {
    assignment: 'assigned' | 'pending_assignment' | 'invalid_state';
    planId: 'essencial' | 'pro' | 'premium' | null;
    subscriptionStatus: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'demo' | null;
    trialUntil: string | null;
    demoWorkspace: boolean;
  };
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
  commercial: {
    assignment: 'assigned' | 'pending_assignment' | 'invalid_state';
    state: import('@/types/commercial').TenantCommercialState | null;
    error: string | null;
    featureConfig: Record<string, boolean>;
    demoWorkspace: boolean;
  };
  commercialAudit: Array<{
    id: string;
    actorId: string;
    action: string;
    reason: string;
    before: unknown;
    after: unknown;
    timestamp: string | null;
  }>;
}

export interface PlatformAuditEntry extends PlatformActivity {
  before: unknown;
  after: unknown;
}

export type CommercialUpdateRequest =
  | { operation: 'assign_plan'; atelierId: string; planId: 'essencial' | 'pro' | 'premium'; subscriptionStatus: 'active' | 'past_due' | 'suspended' | 'cancelled'; reason: string }
  | { operation: 'set_status'; atelierId: string; subscriptionStatus: 'active' | 'past_due' | 'suspended' | 'cancelled'; reason: string }
  | { operation: 'start_trial'; atelierId: string; reason: string }
  | { operation: 'set_entitlement_override'; atelierId: string; featureKey: string; enabled: boolean; reason: string }
  | { operation: 'clear_entitlement_override'; atelierId: string; featureKey: string; reason: string }
  | { operation: 'set_limit_override'; atelierId: string; limitKey: string; limit: number | null; reason: string }
  | { operation: 'clear_limit_override'; atelierId: string; limitKey: string; reason: string };

export interface PlatformDemoCreation {
  atelierId: string;
  slug: string;
  publicUrlPath: string;
  displayName: string;
  demoEmail: string;
  oneTimePassword: string;
  subscriptionStatus: 'demo';
  planId: 'premium';
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

export async function updatePlatformTenantCommercialState(input: CommercialUpdateRequest) {
  const call = httpsCallable<CommercialUpdateRequest, { atelierId: string; state: import('@/types/commercial').TenantCommercialState }>(functionsClient(), 'updatePlatformTenantCommercialState');
  return (await call(input)).data;
}

export async function createPlatformDemoTenant(displayName: string, reason: string) {
  const call = httpsCallable<{ displayName: string; reason: string }, PlatformDemoCreation>(functionsClient(), 'createPlatformDemoTenant');
  return (await call({ displayName, reason })).data;
}

export async function endPlatformDemoTenant(atelierId: string, reason: string) {
  const call = httpsCallable<{ atelierId: string; reason: string }, { atelierId: string; subscriptionStatus: 'cancelled'; operationallySuspended: false; accountDisabled: boolean }>(functionsClient(), 'endPlatformDemoTenant');
  return (await call({ atelierId, reason })).data;
}

export async function setPlatformAtelierStatus(atelierId: string, active: boolean) {
  const call = httpsCallable<{ atelierId: string; active: boolean }, { atelierId: string; active: boolean }>(functionsClient(), 'setPlatformAtelierStatus');
  return (await call({ atelierId, active })).data;
}

export async function listPlatformAuditLogs(cursor: string | null = null) {
  const call = httpsCallable<{ cursor?: string; limit: number }, { entries: PlatformAuditEntry[]; nextCursor: string | null }>(functionsClient(), 'listPlatformAuditLogs');
  return (await call({ ...(cursor ? { cursor } : {}), limit: 25 })).data;
}
