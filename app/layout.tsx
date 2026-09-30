import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AuthProvider } from '@/providers/auth-provider';
import { TenantProvider } from '@/providers/tenant-provider';
import { ToastProvider } from '@/components/ui/toast';

export const metadata: Metadata = {
  title: { default: 'Cosmaker OS — gestão para ateliês de cosplay', template: '%s · Cosmaker OS' },
  description: 'Organize solicitações, orçamentos e a produção do seu ateliê de cosplay em um só lugar.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="pt-BR"><body><AuthProvider><TenantProvider><ToastProvider>{children}</ToastProvider></TenantProvider></AuthProvider></body></html>;
}
