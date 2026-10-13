import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminAuth, adminDb } from '../admin';
import { readActiveTeamActor, requireTeamWorkspace, teamIsoDate, validTeamDocumentId } from './access';
import { mayGrantTeamRole, normalizeTeamEmail, parseTeamPermissions, parseTeamRole } from './policy';

const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const unavailable = () => new HttpsError('failed-precondition', 'O convite não está disponível para esta conta.');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function onlyKeys(data: Record<string, unknown>, keys: string[]) {
  if (Object.keys(data).some((key) => !keys.includes(key))) {
    throw new HttpsError('invalid-argument', 'A solicitação contém campos não aceitos.');
  }
}

function tokenMatches(token: string, storedHash: unknown) {
  if (typeof storedHash !== 'string' || !/^[a-f0-9]{64}$/.test(storedHash)) return false;
  return timingSafeEqual(Buffer.from(hash(token), 'hex'), Buffer.from(storedHash, 'hex'));
}

export const createAtelierInvitation = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para convidar alguém.');
  const identity = await requireTeamWorkspace(call.auth.uid, call.auth.token, 'team:manage');
  const data = record(call.data);
  onlyKeys(data, ['email', 'role', 'permissions']);
  const email = normalizeTeamEmail(data.email);
  const role = parseTeamRole(data.role);
  const permissions = parseTeamPermissions(data.permissions);
  if (!email || !role || !permissions) {
    throw new HttpsError('invalid-argument', 'Informe e-mail, papel e permissões válidos.');
  }
  if (!mayGrantTeamRole(identity.member, role, permissions)) {
    throw new HttpsError('permission-denied', 'Você não pode conceder este papel ou estas permissões.');
  }

  let existingUid: string | null = null;
  try {
    existingUid = (await adminAuth.getUserByEmail(email)).uid;
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
  }

  const atelier = adminDb.doc(`ateliers/${identity.atelierId}`);
  const emailIndexRef = atelier.collection('teamInvitationEmailIndex').doc(hash(email));
  const invitationRef = atelier.collection('teamInvitations').doc();
  const auditRef = adminDb.collection('auditLogs').doc();
  const token = randomBytes(32).toString('hex');
  const expiresAt = Timestamp.fromMillis(Date.now() + invitationLifetimeMs);

  await adminDb.runTransaction(async (transaction) => {
    const [actor, emailIndex, existingMember] = await Promise.all([
      readActiveTeamActor(transaction, identity.atelierId, call.auth!.uid, 'team:manage'),
      transaction.get(emailIndexRef),
      existingUid
        ? transaction.get(atelier.collection('members').doc(existingUid))
        : Promise.resolve(null),
    ]);
    if (!mayGrantTeamRole(actor.member, role, permissions)) {
      throw new HttpsError('permission-denied', 'Você não pode conceder este papel ou estas permissões.');
    }
    if (existingMember?.data()?.active === true) {
      throw new HttpsError('already-exists', 'Essa pessoa já integra a equipe.');
    }
    if (emailIndex.exists) {
      const previousId = emailIndex.data()?.invitationId;
      if (typeof previousId !== 'string' || !validTeamDocumentId(previousId)) {
        throw new HttpsError('failed-precondition', 'O índice de convites precisa ser revisado.');
      }
      const previous = await transaction.get(atelier.collection('teamInvitations').doc(previousId));
      if (previous.exists && previous.data()?.status === 'pending'
        && previous.data()?.expiresAt?.toMillis?.() > Date.now()) {
        throw new HttpsError('already-exists', 'Já existe um convite ativo para este e-mail.');
      }
    }
    const now = FieldValue.serverTimestamp();
    transaction.create(invitationRef, {
      email, emailHash: hash(email), tokenHash: hash(token), role, permissions,
      status: 'pending', createdBy: call.auth!.uid, createdAt: now, updatedAt: now, expiresAt,
    });
    transaction.set(emailIndexRef, { invitationId: invitationRef.id, updatedAt: now });
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: identity.atelierId,
      action: 'team.invitation_created', entity: 'team_invitation', entityId: invitationRef.id,
      after: { emailHash: hash(email), role, permissions, expiresAt },
      timestamp: now,
    });
  });
  return { atelierId: identity.atelierId, invitationId: invitationRef.id, token, expiresAt: expiresAt.toDate().toISOString() };
});

export const listAtelierInvitations = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para consultar os convites.');
  const identity = await requireTeamWorkspace(call.auth.uid, call.auth.token, 'team:read');
  const data = record(call.data);
  onlyKeys(data, ['cursor']);
  const cursor = data.cursor === undefined || data.cursor === null || data.cursor === '' ? null : data.cursor;
  if (cursor !== null && !validTeamDocumentId(cursor)) throw new HttpsError('invalid-argument', 'Cursor inválido.');
  const collection = adminDb.collection(`ateliers/${identity.atelierId}/teamInvitations`);
  let query = collection.orderBy('createdAt', 'desc');
  if (cursor) {
    const cursorSnapshot = await collection.doc(cursor).get();
    if (!cursorSnapshot.exists) throw new HttpsError('invalid-argument', 'A página expirou. Atualize a lista.');
    query = query.startAfter(cursorSnapshot);
  }
  const snapshot = await query.limit(51).get();
  const now = Date.now();
  return {
    invitations: snapshot.docs.slice(0, 50).map((document) => {
      const invitation = document.data();
      const expired = invitation.status === 'pending' && invitation.expiresAt?.toMillis?.() <= now;
      return {
        id: document.id,
        email: invitation.email,
        role: invitation.role,
        permissions: Array.isArray(invitation.permissions) ? invitation.permissions : [],
        status: expired ? 'expired' : invitation.status,
        createdAt: teamIsoDate(invitation.createdAt),
        expiresAt: teamIsoDate(invitation.expiresAt),
        acceptedAt: teamIsoDate(invitation.acceptedAt),
      };
    }),
    nextCursor: snapshot.size > 50 ? snapshot.docs[49].id : null,
  };
});

export const revokeAtelierInvitation = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para revogar o convite.');
  const identity = await requireTeamWorkspace(call.auth.uid, call.auth.token, 'team:manage');
  const data = record(call.data);
  onlyKeys(data, ['invitationId']);
  if (!validTeamDocumentId(data.invitationId)) throw new HttpsError('invalid-argument', 'Convite inválido.');
  const atelier = adminDb.doc(`ateliers/${identity.atelierId}`);
  const invitationRef = atelier.collection('teamInvitations').doc(data.invitationId);
  const auditRef = adminDb.collection('auditLogs').doc();
  await adminDb.runTransaction(async (transaction) => {
    const [actor, invitation] = await Promise.all([
      readActiveTeamActor(transaction, identity.atelierId, call.auth!.uid, 'team:manage'),
      transaction.get(invitationRef),
    ]);
    if (!invitation.exists || invitation.data()?.status !== 'pending') throw unavailable();
    const invitationData = invitation.data()!;
    const emailIndexRef = atelier.collection('teamInvitationEmailIndex').doc(String(invitationData.emailHash));
    const emailIndex = await transaction.get(emailIndexRef);
    if (!mayGrantTeamRole(actor.member, invitationData.role, invitationData.permissions)) {
      throw new HttpsError('permission-denied', 'Você não pode revogar este convite.');
    }
    const now = FieldValue.serverTimestamp();
    transaction.update(invitationRef, { status: 'revoked', revokedBy: call.auth!.uid, revokedAt: now, updatedAt: now });
    if (emailIndex.data()?.invitationId === invitationRef.id) transaction.delete(emailIndexRef);
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: identity.atelierId,
      action: 'team.invitation_revoked', entity: 'team_invitation', entityId: invitationRef.id,
      after: { status: 'revoked' }, timestamp: now,
    });
  });
  return { invitationId: data.invitationId, status: 'revoked' as const };
});

export const acceptAtelierInvitation = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para aceitar o convite.');
  const email = normalizeTeamEmail(call.auth.token.email);
  if (call.auth.token.email_verified !== true || !email || call.auth.token.platformAdmin === true) throw unavailable();
  const data = record(call.data);
  onlyKeys(data, ['atelierId', 'invitationId', 'token']);
  if (!validTeamDocumentId(data.atelierId) || !validTeamDocumentId(data.invitationId)
    || typeof data.token !== 'string' || !/^[a-f0-9]{64}$/.test(data.token)) throw unavailable();
  const atelierRef = adminDb.doc(`ateliers/${data.atelierId}`);
  const invitationRef = atelierRef.collection('teamInvitations').doc(data.invitationId);
  const userRef = adminDb.doc(`users/${call.auth.uid}`);
  const memberRef = atelierRef.collection('members').doc(call.auth.uid);
  const auditRef = adminDb.collection('auditLogs').doc();

  await adminDb.runTransaction(async (transaction) => {
    const [atelier, invitation, user, member] = await Promise.all([
      transaction.get(atelierRef), transaction.get(invitationRef),
      transaction.get(userRef), transaction.get(memberRef),
    ]);
    const invitationData = invitation.data();
    const expiresAtMs = invitationData?.expiresAt?.toMillis?.();
    if (!atelier.exists || atelier.data()?.active !== true
      || !invitation.exists || invitationData?.status !== 'pending'
      || typeof expiresAtMs !== 'number' || expiresAtMs <= Date.now()
      || invitationData.email !== email
      || !tokenMatches(data.token as string, invitationData.tokenHash)
      || !parseTeamRole(invitationData.role)
      || !parseTeamPermissions(invitationData.permissions)) throw unavailable();
    const emailIndexRef = atelierRef.collection('teamInvitationEmailIndex').doc(String(invitationData.emailHash));
    const emailIndex = await transaction.get(emailIndexRef);
    if (emailIndex.data()?.invitationId !== invitationRef.id) throw unavailable();

    const profile = user.data();
    if (user.exists && (profile?.active === false
      || !['client', 'atelier_member'].includes(String(profile?.accountType))
      || (profile?.accountType === 'atelier_member' && profile.atelierId !== data.atelierId))) throw unavailable();
    if (member.data()?.active === true) throw unavailable();

    const now = FieldValue.serverTimestamp();
    const name = typeof profile?.name === 'string' && profile.name.trim()
      ? profile.name.trim()
      : typeof call.auth!.token.name === 'string' && call.auth!.token.name.trim()
        ? call.auth!.token.name.trim()
        : email.split('@')[0];
    transaction.set(userRef, {
      name, email, accountType: 'atelier_member', atelierId: data.atelierId,
      role: invitationData.role, permissions: invitationData.permissions, active: true,
      updatedAt: now, ...(!user.exists ? { createdAt: now } : {}),
    }, { merge: true });
    transaction.set(memberRef, {
      userId: call.auth!.uid, role: invitationData.role, permissions: invitationData.permissions,
      active: true, joinedAt: now, updatedAt: now,
    }, { merge: true });
    transaction.update(invitationRef, {
      status: 'accepted', acceptedBy: call.auth!.uid, acceptedAt: now, updatedAt: now,
    });
    transaction.delete(emailIndexRef);
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: data.atelierId,
      action: 'team.invitation_accepted', entity: 'team_member', entityId: call.auth!.uid,
      after: { invitationId: invitationRef.id, role: invitationData.role, permissions: invitationData.permissions },
      timestamp: now,
    });
  });
  return { atelierId: data.atelierId, status: 'accepted' as const };
});
