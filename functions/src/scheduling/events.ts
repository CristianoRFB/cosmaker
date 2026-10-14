import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { readActiveSchedulingActor, requireSchedulingWorkspace, validSchedulingId } from './access';
import { parseScheduleDate, scheduleDateRange } from './allocate-capacity';

const eventTypes = new Set(['cosplay', 'convention', 'deadline', 'prop_deadline', 'other']);
type EventInput = { title: string; type: string; startDate: string; endDate: string; orderId: string | null; notes: string };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseEvent(data: Record<string, unknown>): EventInput | null {
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const type = typeof data.type === 'string' ? data.type : '';
  const startDate = parseScheduleDate(data.startDate);
  const endDate = parseScheduleDate(data.endDate);
  const orderId = data.orderId === undefined || data.orderId === null || data.orderId === '' ? null : data.orderId;
  const notes = typeof data.notes === 'string' ? data.notes.trim() : '';
  if (title.length < 2 || title.length > 100 || !eventTypes.has(type)
    || !startDate || !endDate || startDate > endDate
    || (orderId !== null && !validSchedulingId(orderId)) || notes.length > 500) return null;
  return { title, type, startDate, endDate, orderId: orderId as string | null, notes };
}

function onlyKeys(data: Record<string, unknown>, keys: string[]) {
  if (Object.keys(data).some((key) => !keys.includes(key))) throw new HttpsError('invalid-argument', 'A solicitação contém campos não aceitos.');
}

export const listAtelierEvents = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para consultar eventos.');
  const identity = await requireSchedulingWorkspace(call.auth.uid, call.auth.token, 'events:read');
  const data = record(call.data);
  onlyKeys(data, ['fromDate', 'toDate']);
  const fromDate = parseScheduleDate(data.fromDate);
  const toDate = parseScheduleDate(data.toDate);
  if (!fromDate || !toDate || !scheduleDateRange(fromDate, toDate, 366)) throw new HttpsError('invalid-argument', 'Informe um intervalo de datas válido de até um ano.');
  const snapshot = await adminDb.collection(`ateliers/${identity.atelierId}/events`)
    .where('endDate', '>=', fromDate).orderBy('endDate', 'asc').limit(251).get();
  if (snapshot.size > 250) throw new HttpsError('resource-exhausted', 'Há muitos eventos neste período. Consulte um intervalo menor.');
  return {
    events: snapshot.docs.flatMap((document) => {
      const event = document.data();
      if (event.status !== 'active' || event.startDate > toDate) return [];
      return [{
        id: document.id, atelierId: identity.atelierId, title: event.title, type: event.type,
        startDate: event.startDate, endDate: event.endDate, orderId: event.orderId ?? null,
        notes: event.notes ?? '', status: event.status, createdBy: event.createdBy,
        createdAt: event.createdAt?.toDate?.().toISOString?.() ?? null,
        updatedAt: event.updatedAt?.toDate?.().toISOString?.() ?? null,
      }];
    }),
  };
});

export const createAtelierEvent = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para registrar um evento.');
  const identity = await requireSchedulingWorkspace(call.auth.uid, call.auth.token, 'events:write');
  const data = record(call.data);
  onlyKeys(data, ['requestId', 'title', 'type', 'startDate', 'endDate', 'orderId', 'notes']);
  if (!validSchedulingId(data.requestId) || !/^[a-zA-Z0-9_-]{8,100}$/.test(data.requestId)) throw new HttpsError('invalid-argument', 'Identificador de solicitação inválido.');
  const input = parseEvent(data);
  if (!input) throw new HttpsError('invalid-argument', 'Revise o título, tipo e período do evento.');
  const eventRef = adminDb.doc(`ateliers/${identity.atelierId}/events/${data.requestId}`);
  const auditRef = adminDb.collection('auditLogs').doc();
  let alreadyCreated = false;
  await adminDb.runTransaction(async (transaction) => {
    const [actor, existing, order] = await Promise.all([
      readActiveSchedulingActor(transaction, identity.atelierId, call.auth!.uid, 'events:write'),
      transaction.get(eventRef),
      input.orderId ? transaction.get(adminDb.doc(`ateliers/${identity.atelierId}/orders/${input.orderId}`)) : Promise.resolve(null),
    ]);
    if (existing.exists) {
      const current = existing.data()!;
      if (current.createdBy === call.auth!.uid && current.title === input.title && current.type === input.type
        && current.startDate === input.startDate && current.endDate === input.endDate && current.orderId === input.orderId
        && current.notes === input.notes) {
        alreadyCreated = true;
        return;
      }
      throw new HttpsError('already-exists', 'Este identificador já foi usado.');
    }
    if (input.orderId && !order?.exists) throw new HttpsError('not-found', 'O pedido vinculado não pertence a este ateliê.');
    const now = FieldValue.serverTimestamp();
    transaction.create(eventRef, { ...input, atelierId: identity.atelierId, status: 'active', createdBy: call.auth!.uid, createdAt: now, updatedAt: now });
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: identity.atelierId, action: 'schedule.event_created',
      entity: 'event', entityId: eventRef.id, before: null,
      after: { title: input.title, type: input.type, startDate: input.startDate, endDate: input.endDate, orderId: input.orderId },
      timestamp: now,
    });
    void actor;
  });
  return { eventId: eventRef.id, status: 'active' as const, alreadyCreated };
});

export const updateAtelierEvent = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para alterar um evento.');
  const identity = await requireSchedulingWorkspace(call.auth.uid, call.auth.token, 'events:write');
  const data = record(call.data);
  onlyKeys(data, ['eventId', 'title', 'type', 'startDate', 'endDate', 'orderId', 'notes']);
  if (!validSchedulingId(data.eventId)) throw new HttpsError('invalid-argument', 'Evento inválido.');
  const input = parseEvent(data);
  if (!input) throw new HttpsError('invalid-argument', 'Revise o título, tipo e período do evento.');
  const eventRef = adminDb.doc(`ateliers/${identity.atelierId}/events/${data.eventId}`);
  const auditRef = adminDb.collection('auditLogs').doc();
  await adminDb.runTransaction(async (transaction) => {
    const [actor, event, order] = await Promise.all([
      readActiveSchedulingActor(transaction, identity.atelierId, call.auth!.uid, 'events:write'),
      transaction.get(eventRef),
      input.orderId ? transaction.get(adminDb.doc(`ateliers/${identity.atelierId}/orders/${input.orderId}`)) : Promise.resolve(null),
    ]);
    if (!event.exists || event.data()?.status !== 'active') throw new HttpsError('not-found', 'O evento não foi encontrado.');
    if (input.orderId && !order?.exists) throw new HttpsError('not-found', 'O pedido vinculado não pertence a este ateliê.');
    const now = FieldValue.serverTimestamp();
    transaction.update(eventRef, { ...input, updatedAt: now });
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: identity.atelierId, action: 'schedule.event_updated',
      entity: 'event', entityId: eventRef.id, before: { title: event.data()?.title, type: event.data()?.type, startDate: event.data()?.startDate, endDate: event.data()?.endDate },
      after: { title: input.title, type: input.type, startDate: input.startDate, endDate: input.endDate }, timestamp: now,
    });
    void actor;
  });
  return { eventId: data.eventId, status: 'updated' as const };
});

export const cancelAtelierEvent = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para cancelar um evento.');
  const identity = await requireSchedulingWorkspace(call.auth.uid, call.auth.token, 'events:write');
  const data = record(call.data);
  onlyKeys(data, ['eventId']);
  if (!validSchedulingId(data.eventId)) throw new HttpsError('invalid-argument', 'Evento inválido.');
  const eventRef = adminDb.doc(`ateliers/${identity.atelierId}/events/${data.eventId}`);
  const auditRef = adminDb.collection('auditLogs').doc();
  await adminDb.runTransaction(async (transaction) => {
    const [actor, event] = await Promise.all([
      readActiveSchedulingActor(transaction, identity.atelierId, call.auth!.uid, 'events:write'),
      transaction.get(eventRef),
    ]);
    if (!event.exists) throw new HttpsError('not-found', 'O evento não foi encontrado.');
    if (event.data()?.status === 'cancelled') return;
    const now = FieldValue.serverTimestamp();
    transaction.update(eventRef, { status: 'cancelled', cancelledAt: now, cancelledBy: call.auth!.uid, updatedAt: now });
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: identity.atelierId, action: 'schedule.event_cancelled',
      entity: 'event', entityId: eventRef.id, before: { status: event.data()?.status }, after: { status: 'cancelled' }, timestamp: now,
    });
    void actor;
  });
  return { eventId: data.eventId, status: 'cancelled' as const };
});
