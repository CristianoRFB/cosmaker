import type { ReactNode } from 'react';
import { WorkspaceLayout } from '@/components/layout/workspace-layout';

export default function PlatformAdminLayout({ children }: { children: ReactNode }) { return <WorkspaceLayout audience="admin" title="Administração da plataforma">{children}</WorkspaceLayout>; }
