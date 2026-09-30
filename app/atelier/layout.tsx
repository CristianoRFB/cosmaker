import type { ReactNode } from 'react';
import { WorkspaceLayout } from '@/components/layout/workspace-layout';

export default function AtelierLayout({ children }: { children: ReactNode }) { return <WorkspaceLayout audience="atelier" title="Painel do ateliê">{children}</WorkspaceLayout>; }
