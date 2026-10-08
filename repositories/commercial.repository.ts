'use client';

import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { CommercialStateResolution, TenantCommercialState } from '@/types/commercial';

function functionsClient() {
  return requireFirebase().functions;
}

export interface TenantCommercialContext {
  assignment: CommercialStateResolution['assignment'];
  state: TenantCommercialState | null;
  demoWorkspace: boolean;
  temporaryAccessExpired: boolean;
}

export interface TenantFeatureAccess {
  featureKey: string;
  allowed: boolean;
  available: boolean;
  implemented: boolean;
  configured: boolean;
  reason: string;
}

export async function getTenantCommercialContext() {
  const call = httpsCallable<void, TenantCommercialContext>(functionsClient(), 'getTenantCommercialContext');
  return (await call()).data;
}

export async function getTenantFeatureAccess(featureKey: string) {
  const call = httpsCallable<{ featureKey: string }, TenantFeatureAccess>(functionsClient(), 'getTenantFeatureAccess');
  return (await call({ featureKey })).data;
}

export async function runTestOnlyCommercialOperation() {
  const call = httpsCallable<Record<string, never>, { accepted: true; featureKey: string; used: number; limit: number | null }>(functionsClient(), 'runTestOnlyCommercialOperation');
  return (await call({})).data;
}
