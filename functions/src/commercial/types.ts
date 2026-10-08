export const SUBSCRIPTION_STATUSES = [
  'trial',
  'active',
  'past_due',
  'suspended',
  'cancelled',
  'demo',
] as const;

export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[number];
export type PlanId = 'essencial' | 'pro' | 'premium';

export interface PlanDefinition {
  id: PlanId;
  name: string;
  rank: number;
  features: readonly string[];
  limits: Readonly<Record<string, number | null>>;
  monthlyPriceCents: number;
  annualPriceCents: number;
  recommended?: boolean;
}

export interface TenantCommercialState {
  planId: PlanId;
  subscriptionStatus: SubscriptionStatus;
  trialUntil?: string | null;
  entitlementOverrides?: Record<string, boolean>;
  limitOverrides?: Record<string, number | null>;
}

export type CommercialStateResolution =
  | { assignment: 'assigned'; state: TenantCommercialState }
  | { assignment: 'pending_assignment' }
  | { assignment: 'invalid_state'; error: string };

export type LimitResolution =
  | { status: 'configured'; limit: number | null; source: 'plan' | 'override' }
  | { status: 'not_configured'; key: string }
  | { status: 'unknown'; key: string };

export interface CommercialTenantSnapshot {
  commercialState?: unknown;
  featureConfig?: unknown;
  demoWorkspace?: boolean;
}

