import type { AtelierRole } from '@/types/user';

export type AtelierPermission =
  | 'atelier:settings'
  | 'team:read' | 'team:manage'
  | 'clients:read' | 'clients:write' | 'clients:delete'
  | 'quotes:read' | 'quotes:write'
  | 'orders:manage'
  | 'measurements:read' | 'measurements:write'
  | 'portfolio:manage'
  | 'finance:read' | 'finance:write'
  | 'inventory:read' | 'inventory:write'
  | 'schedule:read' | 'schedule:write'
  | 'services:read' | 'services:write'
  | 'events:read' | 'events:write';

export function hasAtelierPermission(role: AtelierRole | null | undefined, permissions: string[], required: AtelierPermission) {
  if (role === 'owner' || role === 'admin') return true;
  return permissions.includes(required);
}
