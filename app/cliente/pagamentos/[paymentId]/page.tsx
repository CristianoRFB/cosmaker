'use client';
import { useParams } from 'next/navigation';
import { ClientPayments } from '@/components/payments/client-payments';
export default function DetalheDoPagamento() { return <ClientPayments paymentId={useParams<{ paymentId: string }>().paymentId} />; }
