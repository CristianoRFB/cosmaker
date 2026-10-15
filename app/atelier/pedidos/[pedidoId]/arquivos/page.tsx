'use client';

import { useParams } from 'next/navigation';
import { OrderFilesWorkspace } from '@/components/orders/order-files';

export default function OrderFilesPage() {
  const params = useParams<{ pedidoId: string }>();
  return <OrderFilesWorkspace orderId={params.pedidoId} />;
}
