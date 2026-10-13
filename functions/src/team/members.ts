import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { readActiveTeamActor, requireTeamWorkspace, teamIsoDate, validTeamDocumentId } from './access';
import { mayChangeTeamMember, mayGrantTeamRole, parseTeamPermissions, parseTeamRole } from './policy';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function onlyKeys(data: Record<string, unknown>, keys: string[]) {
  if (Object.keys(data).some((key) => !keys.includes(key))) {
    throw new HttpsError('invalid-argument', 'A solicitação contém campos não aceitos.');
  }
}

export const listAtelierTeam = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para consultar a equipe.');
  const identity = await requireTeamWorkspace(call.auth.uid, call.auth.token, 'team:read');
  const data = record(call.data);
  onlyKeys(data, ['cursor']);
  const cursor = data.cursor === undefined || data.cursor === null || data.cursor === '' ? null : data.cursor;
  if (cursor !== null && !validTeamDocumentId(cursor)) throw new HttpsError('invalid-argument', 'Cursor inválido.');
  const collection = adminDb.collection(`ateliers/${identity.atelierId}/members`);
  let query = collection.orderBy(FieldPath.documentId());
  if (cursor) {
    const cursorSnapshot = await collection.doc(cursor).get();
    if (!cursorSnapshot.exists) throw new HttpsError('invalid-argument', 'A página expirou. Atualize a equipe.');
    query = query.startAfter(cursorSnapshot);
  }
  const result = await query.limit(51).get();
  const page = result.docs.slice(0, 50);
  const profiles = page.length
    ? await adminDb.getAll(...page.map((member) => adminDb.doc(`users/${member.id}`)))
    : [];
  return {
    members: page.map((member, index) => {
      const data = member.data();
      const profile = profiles[index]?.data();
      return {
        id: member.id,
        name: typeof profile?.name === 'string' ? profile.name : 'Membro sem nome',
        email: typeof profile?.email === 'string' ? profile.email : '',
        role: data.role,
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
        active: data.active === true,
        joinedAt: teamIsoDate(data.joinedAt ?? data.createdAt),
      };
    }),
    ownerId: typeof identity.atelier.ownerId === 'string' ? identity.atelier.ownerId : null,
    nextCursor: result.size > 50 ? page[49].id : null,
  };
});

export const updateAtelierMember = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para alterar a equipe.');
  const identity = await requireTeamWorkspace(call.auth.uid, call.auth.token, 'team:manage');
  const data = record(call.data);
  onlyKeys(data, ['memberId', 'role', 'permissions', 'active']);
  if (!validTeamDocumentId(data.memberId) || data.memberId === call.auth.uid) {
    throw new HttpsError('invalid-argument', 'Escolha outro membro da equipe.');
  }
  const role = parseTeamRole(data.role);
  const permissions = parseTeamPermissions(data.permissions);
  if (!role || !permissions || typeof data.active !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Papel, permissões ou estado inválidos.');
  }
  const atelier = adminDb.doc(`ateliers/${identity.atelierId}`);
  const memberRef = atelier.collection('members').doc(data.memberId);
  const userRef = adminDb.doc(`users/${data.memberId}`);
  const auditRef = adminDb.collection('auditLogs').doc();
  await adminDb.runTransaction(async (transaction) => {
    const [actor, target, user] = await Promise.all([
      readActiveTeamActor(transaction, identity.atelierId, call.auth!.uid, 'team:manage'),
      transaction.get(memberRef),
      transaction.get(userRef),
    ]);
    if (!target.exists || !user.exists || user.data()?.atelierId !== identity.atelierId
      || user.data()?.accountType !== 'atelier_member') {
      throw new HttpsError('not-found', 'Este membro não pertence ao ateliê.');
    }
    if (!mayChangeTeamMember(actor.member, target.data()!) || !mayGrantTeamRole(actor.member, role, permissions)) {
      throw new HttpsError('permission-denied', 'Você não pode alterar este membro ou conceder estas permissões.');
    }
    const now = FieldValue.serverTimestamp();
    transaction.update(memberRef, { role, permissions, active: data.active, updatedAt: now });
    transaction.update(userRef, {
      role, permissions,
      ...(data.active ? { active: true } : {}),
      updatedAt: now,
    });
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: identity.atelierId,
      action: 'team.member_updated', entity: 'team_member', entityId: memberRef.id,
      before: { role: target.data()?.role, permissions: target.data()?.permissions, active: target.data()?.active },
      after: { role, permissions, active: data.active }, timestamp: now,
    });
  });
  return { memberId: data.memberId, status: 'updated' as const };
});

export const transferAtelierOwnership = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para transferir a titularidade.');
  const identity = await requireTeamWorkspace(call.auth.uid, call.auth.token, 'team:manage');
  const data = record(call.data);
  onlyKeys(data, ['memberId']);
  if (!validTeamDocumentId(data.memberId) || data.memberId === call.auth.uid) {
    throw new HttpsError('invalid-argument', 'Escolha outro membro ativo da equipe.');
  }
  const atelierRef = adminDb.doc(`ateliers/${identity.atelierId}`);
  const targetMemberRef = atelierRef.collection('members').doc(data.memberId);
  const targetUserRef = adminDb.doc(`users/${data.memberId}`);
  const ownerMemberRef = atelierRef.collection('members').doc(call.auth.uid);
  const ownerUserRef = adminDb.doc(`users/${call.auth.uid}`);
  const auditRef = adminDb.collection('auditLogs').doc();
  await adminDb.runTransaction(async (transaction) => {
    const [actor, target, targetUser] = await Promise.all([
      readActiveTeamActor(transaction, identity.atelierId, call.auth!.uid, 'team:manage'),
      transaction.get(targetMemberRef), transaction.get(targetUserRef),
    ]);
    if (actor.member.role !== 'owner' || actor.atelier.ownerId !== call.auth!.uid) {
      throw new HttpsError('permission-denied', 'Somente o titular atual pode transferir o ateliê.');
    }
    if (!target.exists || target.data()?.active !== true || !targetUser.exists
      || targetUser.data()?.active !== true
      || targetUser.data()?.accountType !== 'atelier_member'
      || targetUser.data()?.atelierId !== identity.atelierId
      || target.data()?.role === 'owner') {
      throw new HttpsError('failed-precondition', 'Escolha um membro ativo deste ateliê.');
    }
    const now = FieldValue.serverTimestamp();
    transaction.update(atelierRef, { ownerId: data.memberId, updatedAt: now });
    transaction.update(ownerMemberRef, { role: 'admin', permissions: [], updatedAt: now });
    transaction.update(ownerUserRef, { role: 'admin', permissions: [], updatedAt: now });
    transaction.update(targetMemberRef, { role: 'owner', permissions: [], updatedAt: now });
    transaction.update(targetUserRef, { role: 'owner', permissions: [], updatedAt: now });
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: identity.atelierId,
      action: 'team.ownership_transferred', entity: 'atelier', entityId: identity.atelierId,
      before: { ownerId: call.auth!.uid },
      after: { ownerId: data.memberId }, timestamp: now,
    });
  });
  return { ownerId: data.memberId };
});
