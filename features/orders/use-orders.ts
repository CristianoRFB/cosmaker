'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { getOrder, getProductionBoard, listAtelierOrders, listClientOrdersPage } from '@/repositories/orders.repository';
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
  const uid = firebaseUser?.uid || '';
  const verified = firebaseUser?.emailVerified === true;
  const [state, setState] = useState<{ uid: string; orders: Order[]; nextCursor: string | null }>({ uid: '', orders: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const reload = useCallback(async (cursor?: string) => {
    const current = ++revision.current;
    if (!uid || !verified || !user?.active || user.accountType !== 'client') { setState({ uid: '', orders: [], nextCursor: null }); setLoading(false); return; }
    setLoading(true); setError('');
    if (!cursor) setState({ uid: '', orders: [], nextCursor: null });
    try {
      const result = await listClientOrdersPage(cursor);
      if (current === revision.current) setState(previous => ({ uid, orders: cursor && previous.uid === uid ? [...previous.orders, ...result.orders] : result.orders, nextCursor: result.nextCursor }));
    } catch (reason) { if (current === revision.current) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os pedidos.'); }
    finally { if (current === revision.current) setLoading(false); }
  }, [uid, verified, user?.active, user?.accountType]);
  useEffect(() => { void reload(); return () => { revision.current++; }; }, [reload]);
  const current = state.uid === uid ? state : { orders: [], nextCursor: null };
  return { orders: current.orders, loading, error, reload: () => reload(), hasMore: Boolean(current.nextCursor), loadMore: () => current.nextCursor ? reload(current.nextCursor) : Promise.resolve() };
}

export function useOrderDetail(atelierId: string, orderId: string, viewer: 'atelier' | 'client' = 'atelier') {
  const { hasPermission } = useTenant();
  const includePayments = viewer === 'client' || hasPermission('finance:read');
  const [record, setRecord] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!atelierId || !orderId) { setRecord(null); setLoading(false); return; }
    setLoading(true); setError('');
    try { setRecord(await getOrder(atelierId, orderId, viewer, includePayments)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o pedido.'); }
    finally { setLoading(false); }
  }, [atelierId, orderId, viewer, includePayments]);
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
