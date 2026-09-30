import { Badge } from './badge';
import type { ReactNode } from 'react';

export function StatusBadge({ children }: { children: ReactNode }) { return <Badge tone="violet">{children}</Badge>; }
