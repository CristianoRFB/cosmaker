'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { resolvePublicTenant, type PublicTenantConfig, type PublicTenantStatus } from '@/services/firebase/public-tenant';

interface PublicTenantContextValue {
  tenantSlug: string;
  tenant: PublicTenantConfig | null;
  status: PublicTenantStatus;
  loading: boolean;
}

const PublicTenantContext = createContext<PublicTenantContextValue | null>(null);

export function PublicTenantProvider({ tenantSlug, children }: { tenantSlug: string; children: ReactNode }) {
  const [tenant, setTenant] = useState<PublicTenantConfig | null>(null);
  const [status, setStatus] = useState<PublicTenantStatus>('error');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void resolvePublicTenant(tenantSlug).then((result) => {
      if (!active) return;
      setTenant(result.tenant ?? null);
      setStatus(result.status);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantSlug]);

  const value = useMemo(() => ({ tenantSlug, tenant, status, loading }), [tenantSlug, tenant, status, loading]);
  return <PublicTenantContext.Provider value={value}>{children}</PublicTenantContext.Provider>;
}

export function usePublicTenant() {
  const context = useContext(PublicTenantContext);
  if (!context) throw new Error('usePublicTenant precisa estar dentro de PublicTenantProvider.');
  return context;
}
