'use client';

import { useParams } from 'next/navigation';
import { OrderHistoryWorkspace } from '@/components/orders/order-history';

export default function OrderHistoryPage() {
  const params = useParams<{ pedidoId: string }>();
  return <OrderHistoryWorkspace orderId={params.pedidoId} />;
}
