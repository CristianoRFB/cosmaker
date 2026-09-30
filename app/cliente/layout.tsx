import type { ReactNode } from 'react';
import { WorkspaceLayout } from '@/components/layout/workspace-layout';

export default function ClientLayout({ children }: { children: ReactNode }) { return <WorkspaceLayout audience="client" title="Minha área">{children}</WorkspaceLayout>; }
