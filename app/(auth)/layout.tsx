import type { ReactNode } from 'react';
import { AuthLayout } from '@/components/layout/site-layout';

export default function AuthenticationLayout({ children }: { children: ReactNode }) { return <AuthLayout>{children}</AuthLayout>; }
