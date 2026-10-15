'use client';

import { useParams } from 'next/navigation';
import { OrderFinancialRecords } from '@/components/orders/order-financial-records';

export default function OrderFinancialPage() {
  const params = useParams<{ pedidoId: string }>();
  return <OrderFinancialRecords orderId={params.pedidoId} />;
}
