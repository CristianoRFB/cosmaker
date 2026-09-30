'use client';

import { useCallback, useEffect, useState } from 'react';
import { getOrder, listAtelierOrders, listClientOrders } from '@/repositories/orders.repository';
import { useAuth } from '@/providers/auth-provider';
import { useTenant } from '@/providers/tenant-provider';
import type { Order, OrderRecord } from '@/types/order';

export function useAtelierOrders() {
  const { atelierId, membershipValid } = useTenant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!atelierId || !membershipValid) { setOrders([]); setLoading(false); return; }
    setLoading(true); setError('');
    try { setOrders(await listAtelierOrders(atelierId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os pedidos.'); }
    finally { setLoading(false); }
  }, [atelierId, membershipValid]);
  useEffect(() => { void reload(); }, [reload]);
  return { atelierId, orders, loading, error, reload };
}

export function useClientOrders() {
  const { user, firebaseUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (!user?.email || firebaseUser?.emailVerified !== true) { setOrders([]); setLoading(false); return; }
    setLoading(true); setError('');
    listClientOrders(user.email).then((result) => { if (active) setOrders(result); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os pedidos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.email, firebaseUser?.emailVerified]);
  return { orders, loading, error };
}

export function useOrderDetail(atelierId: string, orderId: string) {
  const [record, setRecord] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (!atelierId || !orderId) { setRecord(null); setLoading(false); return; }
    setLoading(true); setError('');
    getOrder(atelierId, orderId).then((result) => { if (active) setRecord(result); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o pedido.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [atelierId, orderId]);
  return { record, loading, error };
}
