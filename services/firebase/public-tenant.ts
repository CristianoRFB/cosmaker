'use client';

import { httpsCallable } from 'firebase/functions';
import { firebaseConfigured, requireFirebase } from '@/services/firebase/firebase.client';

export type PublicTenantStatus = 'available' | 'unpublished' | 'suspended' | 'not_found' | 'invalid_slug' | 'not_configured' | 'error';

export interface PublicTenantConfig {
  slug: string;
  name?: string;
  tagline?: string;
  brandColor?: string;
  published: boolean;
  quoteRequestsEnabled: boolean;
}

export interface PublicTenantResolution {
  status: PublicTenantStatus;
  tenant?: PublicTenantConfig;
}

type ResolveResponse = PublicTenantResolution;

export async function resolvePublicTenant(tenantSlug: string): Promise<PublicTenantResolution> {
  if (!firebaseConfigured) return { status: 'not_configured' };
  try {
    const { functions } = requireFirebase();
    const resolve = httpsCallable<{ tenantSlug: string }, ResolveResponse>(functions, 'resolvePublicTenant');
    const result = await resolve({ tenantSlug });
    return result.data;
  } catch {
    return { status: 'error' };
  }
}
