'use client';

import QuoteRequestForm from '@/components/public/quote-request-form';
import { CapRequestForm } from '@/components/public/cap-request-form';
import { usePublicTenant } from '@/providers/public-tenant-provider';

export default function TenantQuoteRequestPage() {
  const { tenant } = usePublicTenant();
  return tenant?.businessType === 'caps' ? <CapRequestForm /> : <QuoteRequestForm />;
}
