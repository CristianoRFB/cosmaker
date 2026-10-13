import type { AtelierRole } from './user';

export type AssignableTeamRole = Exclude<AtelierRole, 'owner'>;

export interface TeamMemberRecord {
  id: string;
  name: string;
  email: string;
  role: AtelierRole;
  permissions: string[];
  active: boolean;
  joinedAt: string | null;
}

export interface TeamInvitationRecord {
  id: string;
  email: string;
  role: AssignableTeamRole;
  permissions: string[];
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  createdAt: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
}
