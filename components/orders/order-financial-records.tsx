'use client';

import { FinanceWorkspace } from '@/components/financeiro/finance-workspace';

export function OrderFinancialRecords({ orderId }: { orderId: string }) {
  return <FinanceWorkspace orderId={orderId} />;
}
