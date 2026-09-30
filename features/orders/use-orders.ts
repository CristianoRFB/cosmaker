'use client';

import { useCallback, useEffect, useState } from 'react';
import { getOrder, getProductionBoard, listAtelierOrders, listClientOrders } from '@/repositories/orders.repository';
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

export function useOrderDetail(atelierId: string, orderId: string, viewer: 'atelier' | 'client' = 'atelier') {
  const [record, setRecord] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!atelierId || !orderId) { setRecord(null); setLoading(false); return; }
    setLoading(true); setError('');
    try { setRecord(await getOrder(atelierId, orderId, viewer)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o pedido.'); }
    finally { setLoading(false); }
  }, [atelierId, orderId, viewer]);
  useEffect(() => { void reload(); }, [reload]);
  return { record, loading, error, reload };
}

export function useProductionBoard() {
  const { atelierId, membershipValid } = useTenant();
  const [stages, setStages] = useState<Awaited<ReturnType<typeof getProductionBoard>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!atelierId || !membershipValid) { setStages([]); setLoading(false); return; }
    setLoading(true); setError('');
    try { setStages(await getProductionBoard(atelierId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a produção.'); }
    finally { setLoading(false); }
  }, [atelierId, membershipValid]);
  useEffect(() => { void reload(); }, [reload]);
  return { atelierId, stages, loading, error, reload };
}
