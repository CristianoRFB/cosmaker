export type AccountType = 'client' | 'atelier_member' | 'platform_admin';
export type AtelierRole = 'owner' | 'admin' | 'cosmaker' | 'assistant' | 'finance';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  photoURL?: string;
  accountType: AccountType;
  atelierId?: string;
  role?: AtelierRole | 'client' | 'platform_admin';
  permissions: string[];
  active: boolean;
}
