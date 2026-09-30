'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase/firebase.client';
import { hasAtelierPermission } from '@/lib/permissions/roles';
import { useAuth } from './auth-provider';
import type { AtelierRole } from '@/types/user';

interface TenantContextValue {
  atelierId: string | null;
  role: AtelierRole | null;
  permissions: string[];
  loading: boolean;
  membershipValid: boolean;
  hasPermission: (permission: string) => boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, firebaseUser } = useAuth();
  const [role, setRole] = useState<AtelierRole | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [membershipValid, setMembershipValid] = useState(false);
  const atelierId = user?.accountType === 'atelier_member' ? user.atelierId ?? null : null;

  useEffect(() => {
    let active = true;
    if (!atelierId || !firebaseUser || !db) {
      setRole(null);
      setPermissions([]);
      setMembershipValid(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    getDoc(doc(db, 'ateliers', atelierId, 'members', firebaseUser.uid))
      .then((snapshot) => {
        if (!active) return;
        const member = snapshot.data();
        // A membership document is already scoped by its /ateliers/{atelierId}/members/{uid} path.
        // The documented member schema does not duplicate atelierId inside the document.
        if (!snapshot.exists() || member?.active !== true) {
          setRole(null);
          setPermissions([]);
          setMembershipValid(false);
          return;
        }
        setRole(typeof member.role === 'string' ? member.role as AtelierRole : null);
        setPermissions(Array.isArray(member.permissions) ? member.permissions.filter((item): item is string => typeof item === 'string') : []);
        setMembershipValid(true);
      })
      .catch(() => {
        if (!active) return;
        setRole(null);
        setPermissions([]);
        setMembershipValid(false);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [atelierId, firebaseUser]);

  const value = useMemo<TenantContextValue>(() => ({
    atelierId,
    role,
    permissions,
    loading,
    membershipValid,
    hasPermission: (permission) => hasAtelierPermission(role, permissions, permission as Parameters<typeof hasAtelierPermission>[2]),
  }), [atelierId, role, permissions, loading, membershipValid]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant precisa estar dentro de TenantProvider.');
  return context;
}
