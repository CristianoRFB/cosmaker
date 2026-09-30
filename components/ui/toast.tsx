'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ToastItem = { id: number; message: string; tone: 'success' | 'error' | 'info' };
const ToastContext = createContext<(message: string, tone?: ToastItem['tone']) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((message: string, tone: ToastItem['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4200);
  }, []);
  const value = useMemo(() => toast, [toast]);
  return <ToastContext.Provider value={value}>{children}<div aria-live="polite" className="fixed right-4 top-4 z-[100] grid max-w-sm gap-2">{items.map((item) => <div className={`rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl ${item.tone === 'error' ? 'bg-rose-700' : item.tone === 'success' ? 'bg-emerald-700' : 'bg-slate-900'}`} key={item.id}>{item.message}</div>)}</div></ToastContext.Provider>;
}

export function useToast() { return useContext(ToastContext); }
