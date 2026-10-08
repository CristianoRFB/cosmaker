import type { ReactNode } from 'react';
import { PublicTenantProvider } from '@/providers/public-tenant-provider';
import { TenantPublicLayout } from '@/components/public/tenant-layout';

export default async function TenantPublicRouteLayout({ children, params }: { children: ReactNode; params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  return <PublicTenantProvider tenantSlug={tenantSlug}><TenantPublicLayout>{children}</TenantPublicLayout></PublicTenantProvider>;
}
