import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { AssignableTeamRole, TeamInvitationRecord, TeamMemberRecord } from '@/types/team';

export async function listAtelierTeam(cursor?: string | null) {
  const { functions } = requireFirebase();
  const callable = httpsCallable<{ cursor?: string | null }, {
    members: TeamMemberRecord[]; ownerId: string | null; nextCursor: string | null;
  }>(functions, 'listAtelierTeam');
  return (await callable(cursor ? { cursor } : {})).data;
}

export async function updateAtelierMember(input: {
  memberId: string; role: AssignableTeamRole; permissions: string[]; active: boolean;
}) {
  const { functions } = requireFirebase();
  const callable = httpsCallable<typeof input, { memberId: string; status: 'updated' }>(functions, 'updateAtelierMember');
  return (await callable(input)).data;
}

export async function transferAtelierOwnership(memberId: string) {
  const { functions } = requireFirebase();
  const callable = httpsCallable<{ memberId: string }, { ownerId: string }>(functions, 'transferAtelierOwnership');
  return (await callable({ memberId })).data;
}

export async function listAtelierInvitations(cursor?: string | null) {
  const { functions } = requireFirebase();
  const callable = httpsCallable<{ cursor?: string | null }, {
    invitations: TeamInvitationRecord[]; nextCursor: string | null;
  }>(functions, 'listAtelierInvitations');
  return (await callable(cursor ? { cursor } : {})).data;
}

export async function createAtelierInvitation(input: {
  email: string; role: AssignableTeamRole; permissions: string[];
}) {
  const { functions } = requireFirebase();
  const callable = httpsCallable<typeof input, {
    atelierId: string; invitationId: string; token: string; expiresAt: string;
  }>(functions, 'createAtelierInvitation');
  return (await callable(input)).data;
}

export async function revokeAtelierInvitation(invitationId: string) {
  const { functions } = requireFirebase();
  const callable = httpsCallable<{ invitationId: string }, { invitationId: string; status: 'revoked' }>(functions, 'revokeAtelierInvitation');
  return (await callable({ invitationId })).data;
}

export async function acceptAtelierInvitation(input: { atelierId: string; invitationId: string; token: string }) {
  const { functions } = requireFirebase();
  const callable = httpsCallable<typeof input, { atelierId: string; status: 'accepted' }>(functions, 'acceptAtelierInvitation');
  return (await callable(input)).data;
}
