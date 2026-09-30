'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { User } from '@/types/user';
import { auth, db, firebaseConfigured } from '@/services/firebase/firebase.client';

interface AuthContextValue {
  firebaseEnabled: boolean;
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  profileError: string | null;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const authRevision = useRef(0);

  const loadUserProfile = useCallback(async (current: FirebaseUser | null, revision: number) => {
    if (!current || !db) {
      if (revision !== authRevision.current) return;
      setFirebaseUser(current ?? null);
      setUser(null);
      setProfileError(null);
      return;
    }

    setFirebaseUser(current);
    try {
      const profile = await getDoc(doc(db, 'users', current.uid));
      if (revision !== authRevision.current || auth?.currentUser?.uid !== current.uid) return;
      if (!profile.exists()) {
        setUser(null);
        setProfileError('Sua conta ainda não tem um perfil do Cosmaker OS. Entre em contato com o suporte.');
        return;
      }
      const data = profile.data();
      setUser({
        id: current.uid,
        name: typeof data.name === 'string' ? data.name : current.displayName || 'Usuário',
        email: typeof data.email === 'string' ? data.email : current.email || '',
        ...(typeof data.phone === 'string' ? { phone: data.phone } : {}),
        ...(typeof data.photoURL === 'string' ? { photoURL: data.photoURL } : {}),
        accountType: data.accountType,
        ...(typeof data.atelierId === 'string' ? { atelierId: data.atelierId } : {}),
        ...(typeof data.role === 'string' ? { role: data.role } : {}),
        permissions: Array.isArray(data.permissions) ? data.permissions.filter((item): item is string => typeof item === 'string') : [],
        active: data.active !== false,
      } as User);
      setProfileError(null);
    } catch {
      if (revision !== authRevision.current || auth?.currentUser?.uid !== current.uid) return;
      setUser(null);
      setProfileError('Não foi possível carregar seu perfil. Verifique sua conexão e tente novamente.');
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const current = auth?.currentUser ?? null;
    const revision = ++authRevision.current;
    setLoading(Boolean(current));
    await loadUserProfile(current, revision);
    if (revision === authRevision.current) setLoading(false);
  }, [loadUserProfile]);

  useEffect(() => {
    const authClient = auth;
    if (!firebaseConfigured || !authClient) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(authClient, (current) => {
      const revision = ++authRevision.current;
      setFirebaseUser(current);
      if (!current) {
        setUser(null);
        setProfileError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      void loadUserProfile(current, revision).finally(() => {
        if (revision === authRevision.current && authClient.currentUser?.uid === current.uid) setLoading(false);
      });
    });
  }, [loadUserProfile]);

  const value = useMemo(() => ({ firebaseEnabled: firebaseConfigured, firebaseUser, user, loading, profileError, refreshUser }), [firebaseUser, user, loading, profileError, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider.');
  return context;
}
