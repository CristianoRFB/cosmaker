import type { ReactNode } from 'react';
import { SiteLayout } from '@/components/layout/site-layout';

export default function PublicLayout({ children }: { children: ReactNode }) { return <SiteLayout>{children}</SiteLayout>; }
