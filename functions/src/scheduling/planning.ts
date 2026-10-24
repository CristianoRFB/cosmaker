import { FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { readActiveSchedulingActor, requireSchedulingWorkspace, schedulingPermission, validSchedulingId } from './access';
import {
  parseScheduleDate, scheduleDateRange, scheduleIntervalsOverlap, scheduleLocalDate,
  scheduleLocalMinute, scheduleWeekday, validScheduleTimezone, validScheduleTimestamp,
} from './allocate-capacity';
import { scheduleBlockedHours, scheduleRisk, sumScheduledHours } from './recalculate-capacity';

const activeOrderStatuses = new Set(['confirmed', 'scheduled', 'modeling', 'in_production', 'fitting', 'adjustments', 'finishing', 'waiting_final_payment', 'ready_to_ship', 'paused']);
const completedStageStatuses = new Set(['completed', 'approved']);
const finalOrderStatuses = new Set(['completed', 'delivered', 'cancelled', 'refunded']);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function onlyKeys(data: Record<string, unknown>, keys: string[]) {
  if (Object.keys(data).some((key) => !keys.includes(key))) throw new HttpsError('invalid-argument', 'A solicitação contém campos não aceitos.');
}

function parseCapacity(data: Record<string, unknown>) {
  const rawHours = record(data.weeklyHoursByWeekday);
  const hours: Record<string, number> = {};
  for (const [day, value] of Object.entries(rawHours)) {
    if (!/^[0-6]$/.test(day) || typeof value !== 'number' || !Number.isFinite(value)
      || value < 0 || value > 16 || Math.round(value * 4) !== value * 4) return null;
    hours[day] = value;
  }
  for (let day = 0; day < 7; day += 1) if (hours[String(day)] === undefined) hours[String(day)] = 0;
  const start = Number(data.workdayStartMinute);
  const end = Number(data.workdayEndMinute);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1440 || end <= start
    || !validScheduleTimezone(data.timezone) || Object.values(hours).some((hoursForDay) => hoursForDay > (end - start) / 60)
    || Object.values(hours).reduce((sum, hoursForDay) => sum + hoursForDay, 0) > 80) return null;
  return { weeklyHoursByWeekday: hours, workdayStartMinute: start, workdayEndMinute: end, timezone: data.timezone };
}

function currentDate(timeZone: string) {
  return scheduleLocalDate(new Date().toISOString(), timeZone) ?? new Date().toISOString().slice(0, 10);
}

function capacityDayId(memberId: string, date: string) {
  return `${memberId}_${date}`;
}

function capacityHoursForDate(capacity: DocumentData, date: string) {
  return Number(record(capacity.weeklyHoursByWeekday)[String(scheduleWeekday(date))]) || 0;
}

function toISOString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().toISOString();
  return null;
}

export const saveMemberScheduleCapacity = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para configurar capacidade.');
  const identity = await requireSchedulingWorkspace(call.auth.uid, call.auth.token, 'schedule:write');
  const data = record(call.data);
  onlyKeys(data, ['memberId', 'weeklyHoursByWeekday', 'workdayStartMinute', 'workdayEndMinute', 'timezone']);
  if (!validSchedulingId(data.memberId)) throw new HttpsError('invalid-argument', 'Membro inválido.');
  const capacity = parseCapacity(data);
  if (!capacity) throw new HttpsError('invalid-argument', 'Revise a capacidade semanal, horário e fuso.');
  const memberRef = adminDb.doc(`ateliers/${identity.atelierId}/members/${data.memberId}`);
  const userRef = adminDb.doc(`users/${data.memberId}`);
  const capacityRef = adminDb.doc(`ateliers/${identity.atelierId}/teamCapacity/${data.memberId}`);
  const slotsQuery = adminDb.collection(`ateliers/${identity.atelierId}/productionSlots`)
    .where('assignedTo', '==', data.memberId).where('status', '==', 'scheduled')
    .where('date', '>=', currentDate(capacity.timezone))
    .limit(401);
  const blocksQuery = adminDb.collection(`ateliers/${identity.atelierId}/scheduleBlocks`)
    .where('memberId', '==', data.memberId).where('status', '==', 'active')
    .where('date', '>=', currentDate(capacity.timezone)).limit(401);
  const auditRef = adminDb.collection('auditLogs').doc();
  await adminDb.runTransaction(async (transaction) => {
    const [actor, member, user, current, slots, blocks] = await Promise.all([
      readActiveSchedulingActor(transaction, identity.atelierId, call.auth!.uid, 'schedule:write'),
      transaction.get(memberRef), transaction.get(userRef), transaction.get(capacityRef), transaction.get(slotsQuery), transaction.get(blocksQuery),
    ]);
    if (!member.exists || member.data()?.active !== true || !user.exists || user.data()?.active !== true
      || user.data()?.accountType !== 'atelier_member' || user.data()?.atelierId !== identity.atelierId) {
      throw new HttpsError('not-found', 'O membro ativo não pertence a este ateliê.');
    }
    if (data.memberId !== call.auth!.uid && !schedulingPermission(actor.member, 'team:manage')) {
      throw new HttpsError('permission-denied', 'Gerenciar a capacidade de outra pessoa exige permissão de gestão da equipe.');
    }
    if (slots.size > 400 || blocks.size > 400) throw new HttpsError('resource-exhausted', 'Há muitos itens futuros para recalcular em uma única operação.');
    if (current.exists && current.data()?.timezone !== capacity.timezone && (slots.size > 0 || blocks.size > 0)) {
      throw new HttpsError('failed-precondition', 'Cancele as alocações e os bloqueios futuros antes de alterar o fuso horário.');
    }
    const byDate = new Map<string, { hours: number; slots: Array<Record<string, unknown>> }>();
    for (const snapshot of slots.docs) {
      const slot = snapshot.data();
      const date = typeof slot.date === 'string' ? slot.date : '';
      const bucket = byDate.get(date) ?? { hours: 0, slots: [] };
      bucket.hours += Number(slot.plannedHours) || 0;
      bucket.slots.push(slot);
      byDate.set(date, bucket);
    }
    for (const [date, bucket] of byDate) {
      if (bucket.hours > capacityHoursForDate(capacity, date)) {
        throw new HttpsError('failed-precondition', `A capacidade de ${date} ficaria abaixo das horas já alocadas.`);
      }
      if (bucket.slots.some((slot) => {
        const startAt = toISOString(slot.startAt);
        const endAt = toISOString(slot.endAt);
        const startMinute = startAt ? scheduleLocalMinute(startAt, capacity.timezone) : null;
        const endMinute = endAt ? scheduleLocalMinute(endAt, capacity.timezone) : null;
        return startMinute === null || endMinute === null
          || scheduleLocalDate(startAt!, capacity.timezone) !== date || scheduleLocalDate(endAt!, capacity.timezone) !== date
          || startMinute < capacity.workdayStartMinute || endMinute > capacity.workdayEndMinute;
      })) throw new HttpsError('failed-precondition', `O expediente alterado conflita com uma alocação em ${date}.`);
    }
    const now = FieldValue.serverTimestamp();
    transaction.set(capacityRef, { ...capacity, memberId: data.memberId, updatedBy: call.auth!.uid, updatedAt: now, ...(!current.exists ? { createdAt: now, createdBy: call.auth!.uid } : {}) }, { merge: true });
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: identity.atelierId, action: 'schedule.capacity_updated',
      entity: 'team_capacity', entityId: data.memberId,
      before: current.exists ? { weeklyHoursByWeekday: current.data()?.weeklyHoursByWeekday, workdayStartMinute: current.data()?.workdayStartMinute, workdayEndMinute: current.data()?.workdayEndMinute } : null,
      after: capacity, timestamp: now,
    });
  });
  return { memberId: data.memberId, weeklyHours: Object.values(capacity.weeklyHoursByWeekday).reduce((sum, hours) => sum + hours, 0) };
});

export const allocateProductionTime = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para alocar horas.');
  const identity = await requireSchedulingWorkspace(call.auth.uid, call.auth.token, 'schedule:write');
  const data = record(call.data);
  onlyKeys(data, ['requestId', 'orderId', 'stageId', 'assignedTo', 'startAt', 'endAt', 'plannedHours', 'deadline']);
  if (!validSchedulingId(data.requestId) || !/^[a-zA-Z0-9_-]{8,100}$/.test(data.requestId)
    || !validSchedulingId(data.orderId) || !validSchedulingId(data.stageId) || !validSchedulingId(data.assignedTo)
    || !validScheduleTimestamp(data.startAt) || !validScheduleTimestamp(data.endAt)
    || (data.deadline !== undefined && data.deadline !== null && !parseScheduleDate(data.deadline))) {
    throw new HttpsError('invalid-argument', 'Revise pedido, etapa, responsável, datas e prazo.');
  }
  const plannedHours = Number(data.plannedHours);
  const startMillis = Date.parse(data.startAt as string);
  const endMillis = Date.parse(data.endAt as string);
  if (!Number.isFinite(plannedHours) || plannedHours < 0.25 || plannedHours > 16 || Math.round(plannedHours * 4) !== plannedHours * 4
    || endMillis <= startMillis || plannedHours > (endMillis - startMillis) / 3_600_000) throw new HttpsError('invalid-argument', 'As horas precisam caber no intervalo informado.');

  const orderRef = adminDb.doc(`ateliers/${identity.atelierId}/orders/${data.orderId}`);
  const stageRef = orderRef.collection('productionStages').doc(data.stageId as string);
  const memberRef = adminDb.doc(`ateliers/${identity.atelierId}/members/${data.assignedTo}`);
  const userRef = adminDb.doc(`users/${data.assignedTo}`);
  const capacityRef = adminDb.doc(`ateliers/${identity.atelierId}/teamCapacity/${data.assignedTo}`);
  const slotRef = adminDb.doc(`ateliers/${identity.atelierId}/productionSlots/${data.requestId}`);
  const auditRef = adminDb.collection('auditLogs').doc();
  const historyRef = orderRef.collection('statusHistory').doc();
  let resultingDate = '';
  let alreadyCreated = false;
  await adminDb.runTransaction(async (transaction) => {
    const [actor, order, stage, member, user, capacitySnapshot, existingSlot] = await Promise.all([
      readActiveSchedulingActor(transaction, identity.atelierId, call.auth!.uid, 'schedule:write'),
      transaction.get(orderRef), transaction.get(stageRef), transaction.get(memberRef), transaction.get(userRef),
      transaction.get(capacityRef), transaction.get(slotRef),
    ]);
    if (existingSlot.exists) {
      const existing = existingSlot.data()!;
      const startAt = toISOString(existing.startAt);
      const endAt = toISOString(existing.endAt);
      if (existing.status === 'scheduled' && existing.createdBy === call.auth!.uid && existing.orderId === data.orderId && existing.stageId === data.stageId
        && existing.assignedTo === data.assignedTo && startAt === new Date(startMillis).toISOString()
        && endAt === new Date(endMillis).toISOString() && Number(existing.plannedHours) === plannedHours
        && (existing.requestedDeadline ?? null) === (data.deadline ?? null)) {
        resultingDate = String(existing.date); alreadyCreated = true; return;
      }
      throw new HttpsError('already-exists', 'Este identificador de alocação já foi usado.');
    }
    if (!order.exists || !activeOrderStatuses.has(String(order.data()?.status)) || !stage.exists) {
      throw new HttpsError('failed-precondition', 'O pedido ativo e a etapa precisam pertencer a este ateliê.');
    }
    if (completedStageStatuses.has(String(stage.data()?.status)) || stage.data()?.status === 'waiting_approval') throw new HttpsError('failed-precondition', 'Uma etapa concluída, aprovada ou aguardando aprovação não pode receber novas horas.');
    if (!member.exists || member.data()?.active !== true || !user.exists || user.data()?.active !== true
      || user.data()?.accountType !== 'atelier_member' || user.data()?.atelierId !== identity.atelierId) throw new HttpsError('failed-precondition', 'O responsável precisa ser membro ativo deste ateliê.');
    if (!capacitySnapshot.exists) throw new HttpsError('failed-precondition', 'Configure a capacidade semanal do responsável antes de alocar horas.');
    if (data.assignedTo !== call.auth!.uid && !schedulingPermission(actor.member, 'team:manage')) {
      throw new HttpsError('permission-denied', 'Alocar horas para outra pessoa exige permissão de gestão da equipe.');
    }
    const capacity = capacitySnapshot.data()!;
    const timezone = String(capacity.timezone);
    const startIso = new Date(startMillis).toISOString();
    const endIso = new Date(endMillis).toISOString();
    const date = scheduleLocalDate(startIso, timezone);
    const endDate = scheduleLocalDate(endIso, timezone);
    const startMinute = scheduleLocalMinute(startIso, timezone);
    const endMinute = scheduleLocalMinute(endIso, timezone);
    if (!date || date !== endDate || startMinute === null || endMinute === null
      || startMinute < Number(capacity.workdayStartMinute) || endMinute > Number(capacity.workdayEndMinute)) {
      throw new HttpsError('failed-precondition', 'A alocação precisa caber no expediente do responsável e em um único dia local.');
    }
    if (startMillis <= Date.now()) throw new HttpsError('failed-precondition', 'Não é possível criar uma alocação em um horário que já passou.');
    const dailyCapacity = capacityHoursForDate(capacity, date);
    if (dailyCapacity <= 0) throw new HttpsError('failed-precondition', 'O responsável não tem capacidade configurada para este dia da semana.');
    if (stage.data()?.assignedTo && stage.data()?.assignedTo !== data.assignedTo) throw new HttpsError('failed-precondition', 'A etapa já está atribuída a outra pessoa. Cancele as horas atuais antes de reatribuir.');
    const plannedStartDate = stage.get('plannedStartDate') ?? null;
    const stageDeadline = data.deadline !== undefined ? data.deadline : stage.get('deadline') ?? null;
    if ((plannedStartDate !== null && !parseScheduleDate(plannedStartDate)) || (stageDeadline !== null && !parseScheduleDate(stageDeadline))) throw new HttpsError('failed-precondition', 'As datas configuradas da etapa precisam de revisão.');
    if ((plannedStartDate && date < String(plannedStartDate)) || (stageDeadline && date > String(stageDeadline))
      || (plannedStartDate && stageDeadline && String(plannedStartDate) > String(stageDeadline))) throw new HttpsError('failed-precondition', 'As horas precisam respeitar o início planejado e o prazo da etapa.');

    const dayLockRef = adminDb.doc(`ateliers/${identity.atelierId}/scheduleDays/${capacityDayId(data.assignedTo as string, date)}`);
    const slotsQuery = adminDb.collection(`ateliers/${identity.atelierId}/productionSlots`)
      .where('assignedTo', '==', data.assignedTo).where('date', '==', date).where('status', '==', 'scheduled').limit(101);
    const blocksQuery = adminDb.collection(`ateliers/${identity.atelierId}/scheduleBlocks`)
      .where('memberId', '==', data.assignedTo).where('date', '==', date).where('status', '==', 'active').limit(101);
    const stageSlotsQuery = adminDb.collection(`ateliers/${identity.atelierId}/productionSlots`)
      .where('orderId', '==', data.orderId).where('stageId', '==', data.stageId).where('status', '==', 'scheduled').limit(101);
    const [dayLock, slots, blocks, stageSlots] = await Promise.all([
      transaction.get(dayLockRef), transaction.get(slotsQuery), transaction.get(blocksQuery), transaction.get(stageSlotsQuery),
    ]);
    if (slots.size > 100 || blocks.size > 100 || stageSlots.size > 100) throw new HttpsError('resource-exhausted', 'Há muitos registros neste dia ou etapa para validar a alocação.');
    if (stageSlots.docs.some((slot) => (plannedStartDate && String(slot.get('date')) < String(plannedStartDate))
      || (stageDeadline && String(slot.get('date')) > String(stageDeadline)))) throw new HttpsError('failed-precondition', 'O prazo e o início planejado precisam incluir as horas já alocadas na etapa.');
    const allocatedHours = sumScheduledHours(slots.docs.map((slot) => ({ plannedHours: Number(slot.data().plannedHours) || 0, status: slot.data().status })));
    const blockedHours = scheduleBlockedHours(blocks.docs.map((block) => ({ ...block.data() })), dailyCapacity,
      Number(capacity.workdayStartMinute), Number(capacity.workdayEndMinute));
    if (allocatedHours + plannedHours + blockedHours > dailyCapacity) throw new HttpsError('failed-precondition', 'A alocação excede as horas disponíveis após considerar bloqueios e pausas.');
    if (slots.docs.some((slot) => {
      const start = toISOString(slot.data().startAt);
      const end = toISOString(slot.data().endAt);
      return !start || !end || scheduleIntervalsOverlap(startMillis, endMillis, Date.parse(start), Date.parse(end));
    })) throw new HttpsError('already-exists', 'Este horário já está reservado para a pessoa escolhida.');
    if (blocks.docs.some((block) => {
      const item = block.data();
      if (item.allDay === true) return true;
      return scheduleIntervalsOverlap(startMinute, endMinute, Number(item.startMinute), Number(item.endMinute));
    })) throw new HttpsError('failed-precondition', 'O horário conflita com um bloqueio, pausa ou férias.');

    const now = Timestamp.now();
    const statusHistory = order.data()?.status === 'confirmed' ? 'scheduled' : String(order.data()?.status);
    transaction.create(slotRef, {
      atelierId: identity.atelierId, date, orderId: data.orderId, stageId: data.stageId,
      stageName: String(stage.data()?.name ?? 'Etapa'), assignedTo: data.assignedTo,
      startAt: Timestamp.fromMillis(startMillis), endAt: Timestamp.fromMillis(endMillis),
      timezone, plannedHours, status: 'scheduled', createdBy: call.auth!.uid, createdAt: now, updatedAt: now,
      requestedDeadline: data.deadline ?? null,
    });
    transaction.set(dayLockRef, {
      memberId: data.assignedTo, date, allocatedHours: allocatedHours + plannedHours,
      revision: Number(dayLock.data()?.revision ?? 0) + 1, updatedAt: now,
    }, { merge: true });
    transaction.update(stageRef, {
      assignedTo: data.assignedTo,
      ...(data.deadline !== undefined ? { deadline: data.deadline } : {}),
      version: FieldValue.increment(1),
      updatedAt: now,
    });
    if (statusHistory !== order.data()?.status) {
      transaction.update(orderRef, { status: statusHistory, updatedAt: now });
      transaction.create(historyRef, { status: statusHistory, actorId: call.auth!.uid, source: 'schedule_allocation', createdAt: now });
    }
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: identity.atelierId, action: 'schedule.production_time_allocated',
      entity: 'production_slot', entityId: slotRef.id,
      before: null, after: { orderId: data.orderId, stageId: data.stageId, assignedTo: data.assignedTo, date, plannedHours, startAt: startIso, endAt: endIso }, timestamp: FieldValue.serverTimestamp(),
    });
    resultingDate = date;
  });
  return { slotId: slotRef.id, date: resultingDate, status: 'scheduled' as const, alreadyCreated };
});

export const cancelProductionSlot = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para remover uma alocação.');
  const identity = await requireSchedulingWorkspace(call.auth.uid, call.auth.token, 'schedule:write');
  const data = record(call.data);
  onlyKeys(data, ['slotId']);
  if (!validSchedulingId(data.slotId)) throw new HttpsError('invalid-argument', 'Alocação inválida.');
  const slotRef = adminDb.doc(`ateliers/${identity.atelierId}/productionSlots/${data.slotId}`);
  const auditRef = adminDb.collection('auditLogs').doc();
  await adminDb.runTransaction(async (transaction) => {
    const [actor, slot] = await Promise.all([
      readActiveSchedulingActor(transaction, identity.atelierId, call.auth!.uid, 'schedule:write'),
      transaction.get(slotRef),
    ]);
    if (!slot.exists) throw new HttpsError('not-found', 'A alocação não foi encontrada.');
    const item = slot.data()!;
    if (item.status === 'cancelled') return;
    if (item.status !== 'scheduled') throw new HttpsError('failed-precondition', 'Somente horas planejadas podem ser canceladas.');
    if (item.assignedTo !== call.auth!.uid && !schedulingPermission(actor.member, 'team:manage')) {
      throw new HttpsError('permission-denied', 'Remover horas de outra pessoa exige permissão de gestão da equipe.');
    }
    const dayLockRef = adminDb.doc(`ateliers/${identity.atelierId}/scheduleDays/${capacityDayId(String(item.assignedTo), String(item.date))}`);
    const orderRef = adminDb.doc(`ateliers/${identity.atelierId}/orders/${item.orderId}`);
    const stageRef = orderRef.collection('productionStages').doc(String(item.stageId));
    const sameDayQuery = adminDb.collection(`ateliers/${identity.atelierId}/productionSlots`)
      .where('assignedTo', '==', item.assignedTo).where('date', '==', item.date).where('status', '==', 'scheduled').limit(101);
    const sameStageQuery = adminDb.collection(`ateliers/${identity.atelierId}/productionSlots`)
      .where('orderId', '==', item.orderId).where('stageId', '==', item.stageId).where('status', '==', 'scheduled').limit(101);
    const sameOrderQuery = adminDb.collection(`ateliers/${identity.atelierId}/productionSlots`)
      .where('orderId', '==', item.orderId).where('status', '==', 'scheduled').limit(201);
    const allStagesQuery = orderRef.collection('productionStages');
    const [dayLock, order, stage, sameDay, sameStage, sameOrder, allStages] = await Promise.all([
      transaction.get(dayLockRef), transaction.get(orderRef), transaction.get(stageRef),
      transaction.get(sameDayQuery), transaction.get(sameStageQuery), transaction.get(sameOrderQuery), transaction.get(allStagesQuery),
    ]);
    if (sameDay.size > 100 || sameStage.size > 100 || sameOrder.size > 200) throw new HttpsError('resource-exhausted', 'Há muitos registros para recalcular esta alocação.');
    const frozenStage = stage.exists && (completedStageStatuses.has(String(stage.get('status'))) || stage.get('status') === 'waiting_approval');
    if (frozenStage) {
      const startsAt = toISOString(item.startAt);
      if (!startsAt || Date.parse(startsAt) <= Date.now()) throw new HttpsError('failed-precondition', 'Somente horas futuras de uma etapa concluída, aprovada ou aguardando aprovação podem ser liberadas.');
    }
    const nextHours = Math.max(0, sumScheduledHours(sameDay.docs.filter((document) => document.id !== slotRef.id)
      .map((document) => ({ plannedHours: Number(document.data().plannedHours) || 0, status: document.data().status }))));
    const hasOtherStageSlots = sameStage.docs.some((document) => document.id !== slotRef.id);
    const hasOtherOrderSlots = sameOrder.docs.some((document) => document.id !== slotRef.id);
    const allStagesStillPending = allStages.docs.every((document) => document.data().status === 'pending');
    const now = FieldValue.serverTimestamp();
    transaction.update(slotRef, { status: 'cancelled', cancelledBy: call.auth!.uid, cancelledAt: now, updatedAt: now });
    transaction.set(dayLockRef, {
      memberId: item.assignedTo, date: item.date, allocatedHours: nextHours,
      revision: Number(dayLock.data()?.revision ?? 0) + 1, updatedAt: now,
    }, { merge: true });
    if (!frozenStage && !hasOtherStageSlots && stage.exists && stage.data()?.assignedTo === item.assignedTo) {
      transaction.update(stageRef, { assignedTo: null, version: FieldValue.increment(1), updatedAt: now });
    }
    if (order.exists && order.data()?.status === 'scheduled' && !hasOtherOrderSlots && allStagesStillPending) {
      transaction.update(orderRef, { status: 'confirmed', updatedAt: now });
      transaction.create(orderRef.collection('statusHistory').doc(), { status: 'confirmed', actorId: call.auth!.uid, source: 'schedule_allocation_cancelled', createdAt: now });
    }
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: identity.atelierId, action: 'schedule.production_time_cancelled',
      entity: 'production_slot', entityId: slotRef.id,
      before: { status: item.status, date: item.date, plannedHours: item.plannedHours }, after: { status: 'cancelled' }, timestamp: now,
    });
  });
  return { slotId: data.slotId, status: 'cancelled' as const };
});

export const createScheduleBlock = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para bloquear horários.');
  const identity = await requireSchedulingWorkspace(call.auth.uid, call.auth.token, 'schedule:write');
  const data = record(call.data);
  onlyKeys(data, ['requestId', 'memberId', 'startDate', 'endDate', 'startMinute', 'endMinute', 'allDay', 'type', 'title']);
  if (!validSchedulingId(data.requestId) || !/^[a-zA-Z0-9_-]{8,100}$/.test(data.requestId)
    || !validSchedulingId(data.memberId) || !['pause', 'leave', 'vacation', 'other'].includes(String(data.type))
    || typeof data.title !== 'string' || data.title.trim().length < 2 || data.title.trim().length > 100
    || typeof data.allDay !== 'boolean') throw new HttpsError('invalid-argument', 'Revise o responsável, título e tipo do bloqueio.');
  const startDate = parseScheduleDate(data.startDate);
  const endDate = parseScheduleDate(data.endDate);
  const dates = startDate && endDate ? scheduleDateRange(startDate, endDate, 31) : null;
  const startMinute = data.allDay ? 0 : Number(data.startMinute);
  const endMinute = data.allDay ? 1440 : Number(data.endMinute);
  if (!dates || (dates.length > 1 && !data.allDay) || !Number.isInteger(startMinute) || !Number.isInteger(endMinute)
    || startMinute < 0 || endMinute > 1440 || endMinute <= startMinute) throw new HttpsError('invalid-argument', 'O bloqueio precisa ter datas e horários válidos; períodos acima de um dia ocupam dias inteiros.');
  const memberRef = adminDb.doc(`ateliers/${identity.atelierId}/members/${data.memberId}`);
  const userRef = adminDb.doc(`users/${data.memberId}`);
  const capacityRef = adminDb.doc(`ateliers/${identity.atelierId}/teamCapacity/${data.memberId}`);
  const blocksCollection = adminDb.collection(`ateliers/${identity.atelierId}/scheduleBlocks`);
  const slotCollection = adminDb.collection(`ateliers/${identity.atelierId}/productionSlots`);
  const groupRefs = dates.map((date) => blocksCollection.doc(`${data.requestId}-${date}`));
  const dayLockRefs = dates.map((date) => adminDb.doc(`ateliers/${identity.atelierId}/scheduleDays/${capacityDayId(data.memberId as string, date)}`));
  const slotsQuery = slotCollection.where('assignedTo', '==', data.memberId).where('status', '==', 'scheduled')
    .where('date', '>=', startDate!).where('date', '<=', endDate!).limit(401);
  const existingBlocksQuery = blocksCollection.where('memberId', '==', data.memberId).where('status', '==', 'active')
    .where('date', '>=', startDate!).where('date', '<=', endDate!).limit(401);
  const auditRef = adminDb.collection('auditLogs').doc();
  let alreadyCreated = false;
  await adminDb.runTransaction(async (transaction) => {
    const [actor, member, user, capacitySnapshot, previousBlocks, locks, slots, existingBlocks] = await Promise.all([
      readActiveSchedulingActor(transaction, identity.atelierId, call.auth!.uid, 'schedule:write'),
      transaction.get(memberRef), transaction.get(userRef), transaction.get(capacityRef), transaction.getAll(...groupRefs),
      transaction.getAll(...dayLockRefs), transaction.get(slotsQuery), transaction.get(existingBlocksQuery),
    ]);
    if (!member.exists || member.data()?.active !== true || !user.exists || user.data()?.active !== true
      || user.data()?.accountType !== 'atelier_member' || user.data()?.atelierId !== identity.atelierId) throw new HttpsError('not-found', 'O membro ativo não pertence a este ateliê.');
    if (data.memberId !== call.auth!.uid && !schedulingPermission(actor.member, 'team:manage')) throw new HttpsError('permission-denied', 'Bloquear a agenda de outra pessoa exige permissão de gestão da equipe.');
    const timezone = String(capacitySnapshot.data()?.timezone ?? actor.atelier.timezone ?? 'America/Sao_Paulo');
    if (slots.size > 400 || existingBlocks.size > 400) throw new HttpsError('resource-exhausted', 'Há muitos itens no período para validar o bloqueio.');
    if (previousBlocks.some((block) => block.exists)) {
      const matches = previousBlocks.every((block) => {
        const current = block.data();
        return current?.groupId === data.requestId && current?.title === String(data.title).trim()
          && current?.type === data.type && current?.status === 'active';
      });
      if (matches) { alreadyCreated = true; return; }
      throw new HttpsError('already-exists', 'Este identificador de bloqueio já foi usado.');
    }
    const conflictingSlot = slots.docs.find((slot) => {
      const value = slot.data();
      if (!dates.includes(String(value.date))) return false;
      if (data.allDay) return true;
      const startAt = toISOString(value.startAt);
      const endAt = toISOString(value.endAt);
      const slotStart = startAt ? scheduleLocalMinute(startAt, timezone) : null;
      const slotEnd = endAt ? scheduleLocalMinute(endAt, timezone) : null;
      return slotStart === null || slotEnd === null || scheduleIntervalsOverlap(startMinute, endMinute, slotStart, slotEnd);
    });
    if (conflictingSlot) throw new HttpsError('failed-precondition', `O bloqueio conflita com uma alocação em ${String(conflictingSlot.data().date)}.`);
    const conflictingBlock = existingBlocks.docs.find((block) => {
      const value = block.data();
      if (!dates.includes(String(value.date))) return false;
      if (data.allDay || value.allDay === true) return true;
      return scheduleIntervalsOverlap(startMinute, endMinute, Number(value.startMinute), Number(value.endMinute));
    });
    if (conflictingBlock) throw new HttpsError('already-exists', `O horário conflita com outro bloqueio em ${String(conflictingBlock.data().date)}.`);
    const capacity = capacitySnapshot.data() ?? {};
    for (const date of dates) {
      const dailyCapacity = capacityHoursForDate(capacity, date);
      const dailySlots = slots.docs.filter((slot) => slot.data().date === date);
      const dailyBlocks = existingBlocks.docs.filter((block) => block.data().date === date).map((block) => block.data());
      const blockedHours = scheduleBlockedHours([...dailyBlocks, {
        allDay: data.allDay, startMinute, endMinute, status: 'active',
      }], dailyCapacity, Number(capacity.workdayStartMinute ?? 0), Number(capacity.workdayEndMinute ?? 1440));
      const allocatedHours = sumScheduledHours(dailySlots.map((slot) => ({
        plannedHours: Number(slot.data().plannedHours) || 0, status: String(slot.data().status),
      })));
      if (allocatedHours + blockedHours > dailyCapacity) {
        throw new HttpsError('failed-precondition', `O bloqueio reduziria a capacidade abaixo das horas alocadas em ${date}.`);
      }
    }
    const now = FieldValue.serverTimestamp();
    for (let index = 0; index < dates.length; index += 1) {
      transaction.create(groupRefs[index], {
        atelierId: identity.atelierId, groupId: data.requestId, memberId: data.memberId,
        date: dates[index], startDate, endDate, startMinute, endMinute, allDay: data.allDay,
        timezone, type: data.type, title: String(data.title).trim(), status: 'active',
        createdBy: call.auth!.uid, createdAt: now, updatedAt: now,
      });
      transaction.set(dayLockRefs[index], {
        memberId: data.memberId, date: dates[index], revision: Number(locks[index].data()?.revision ?? 0) + 1,
        updatedAt: now,
      }, { merge: true });
    }
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: identity.atelierId, action: 'schedule.block_created',
      entity: 'schedule_block', entityId: String(data.requestId), before: null,
      after: { memberId: data.memberId, startDate, endDate, startMinute, endMinute, allDay: data.allDay, type: data.type }, timestamp: now,
    });
  });
  return { groupId: data.requestId, dates, status: 'active' as const, alreadyCreated };
});

export const cancelScheduleBlock = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para cancelar um bloqueio.');
  const identity = await requireSchedulingWorkspace(call.auth.uid, call.auth.token, 'schedule:write');
  const data = record(call.data);
  onlyKeys(data, ['groupId']);
  if (!validSchedulingId(data.groupId)) throw new HttpsError('invalid-argument', 'Bloqueio inválido.');
  const collection = adminDb.collection(`ateliers/${identity.atelierId}/scheduleBlocks`);
  const auditRef = adminDb.collection('auditLogs').doc();
  await adminDb.runTransaction(async (transaction) => {
    const actor = await readActiveSchedulingActor(transaction, identity.atelierId, call.auth!.uid, 'schedule:write');
    const blocks = await transaction.get(collection.where('groupId', '==', data.groupId).limit(31));
    if (blocks.empty) throw new HttpsError('not-found', 'O bloqueio não foi encontrado.');
    const first = blocks.docs[0].data();
    if (first.memberId !== call.auth!.uid && !schedulingPermission(actor.member, 'team:manage')) throw new HttpsError('permission-denied', 'Cancelar o bloqueio de outra pessoa exige permissão de gestão da equipe.');
    const dates = blocks.docs.map((block) => String(block.data().date));
    const locks = dates.map((date) => adminDb.doc(`ateliers/${identity.atelierId}/scheduleDays/${capacityDayId(String(first.memberId), date)}`));
    const lockSnapshots = await transaction.getAll(...locks);
    const activeBlocks = blocks.docs.filter((block) => block.data().status === 'active');
    if (!activeBlocks.length) return;
    const now = FieldValue.serverTimestamp();
    activeBlocks.forEach((block) => transaction.update(block.ref, { status: 'cancelled', cancelledBy: call.auth!.uid, cancelledAt: now, updatedAt: now }));
    activeBlocks.forEach((block, index) => transaction.set(locks[index], {
      memberId: first.memberId, date: block.data().date,
      revision: Number(lockSnapshots[index].data()?.revision ?? 0) + 1, updatedAt: now,
    }, { merge: true }));
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: identity.atelierId, action: 'schedule.block_cancelled',
      entity: 'schedule_block', entityId: String(data.groupId), before: { status: 'active' }, after: { status: 'cancelled' }, timestamp: now,
    });
  });
  return { groupId: data.groupId, status: 'cancelled' as const };
});

export const listScheduleWorkspace = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para consultar a agenda.');
  const identity = await requireSchedulingWorkspace(call.auth.uid, call.auth.token, 'schedule:read');
  const data = record(call.data);
  onlyKeys(data, ['fromDate', 'toDate']);
  const fromDate = parseScheduleDate(data.fromDate);
  const toDate = parseScheduleDate(data.toDate);
  const dates = fromDate && toDate ? scheduleDateRange(fromDate, toDate, 31) : null;
  if (!dates || !fromDate || !toDate) throw new HttpsError('invalid-argument', 'Informe um período de agenda válido de até 31 dias.');
  const atelier = adminDb.doc(`ateliers/${identity.atelierId}`);
  const memberCollection = atelier.collection('members');
  const slotCollection = atelier.collection('productionSlots');
  const blockCollection = atelier.collection('scheduleBlocks');
  const canReadEvents = schedulingPermission(identity.member, 'events:read');
  const [memberSnapshot, slotSnapshot, blockSnapshot, stageSnapshot, eventSnapshot] = await Promise.all([
    memberCollection.where('active', '==', true).limit(200).get(),
    slotCollection.where('date', '>=', fromDate).where('date', '<=', toDate).orderBy('date', 'asc').limit(500).get(),
    blockCollection.where('date', '>=', fromDate).where('date', '<=', toDate).orderBy('date', 'asc').limit(500).get(),
    adminDb.collectionGroup('productionStages').where('atelierId', '==', identity.atelierId).limit(1200).get(),
    canReadEvents
      ? atelier.collection('events').where('endDate', '>=', fromDate).orderBy('endDate', 'asc').limit(501).get()
      : Promise.resolve(null),
  ]);
  if (memberSnapshot.size >= 200 || slotSnapshot.size >= 500 || blockSnapshot.size >= 500 || stageSnapshot.size >= 1200 || (eventSnapshot?.size ?? 0) > 500) {
    throw new HttpsError('resource-exhausted', 'O período contém muitos registros. Consulte um intervalo menor.');
  }
  const memberIds = memberSnapshot.docs.map((member) => member.id);
  const [profiles, capacityDocs] = memberIds.length ? await Promise.all([
    adminDb.getAll(...memberIds.map((uid) => adminDb.doc(`users/${uid}`))),
    adminDb.getAll(...memberIds.map((uid) => adminDb.doc(`ateliers/${identity.atelierId}/teamCapacity/${uid}`))),
  ]) : [[], []];
  const profileMap = new Map(memberIds.map((uid, index) => [uid, profiles[index]?.data()]));
  const capacityMap = new Map(memberIds.map((uid, index) => [uid, capacityDocs[index]?.data()]));
  const canReadTeam = schedulingPermission(identity.member, 'team:read');
  const memberList = memberSnapshot.docs.flatMap((member) => {
    const profile = profileMap.get(member.id);
    if (!profile || profile.accountType !== 'atelier_member' || profile.atelierId !== identity.atelierId || profile.active !== true) return [];
    const capacity = capacityMap.get(member.id);
    if (!capacity) return [{
      memberId: member.id, memberName: String(profile.name ?? 'Membro'), memberEmail: canReadTeam ? String(profile.email ?? '') : '',
      weeklyHoursByWeekday: {}, workdayStartMinute: 0, workdayEndMinute: 0, timezone: 'America/Sao_Paulo', weeklyHours: 0,
    }];
    const weeklyHoursByWeekday = record(capacity.weeklyHoursByWeekday) as Record<string, number>;
    return [{
      memberId: member.id, memberName: String(profile.name ?? 'Membro'), memberEmail: canReadTeam ? String(profile.email ?? '') : '',
      weeklyHoursByWeekday, workdayStartMinute: Number(capacity.workdayStartMinute), workdayEndMinute: Number(capacity.workdayEndMinute),
      timezone: String(capacity.timezone ?? 'America/Sao_Paulo'),
      weeklyHours: Object.values(weeklyHoursByWeekday).reduce((sum, hours) => sum + Number(hours || 0), 0),
    }];
  });
  const nameFor = (uid: string) => String(profileMap.get(uid)?.name ?? 'Membro');
  const slots = slotSnapshot.docs.map((document) => {
    const item = document.data();
    return {
      id: document.id, atelierId: identity.atelierId, date: String(item.date), orderId: String(item.orderId),
      stageId: String(item.stageId), stageName: String(item.stageName ?? 'Etapa'), assignedTo: String(item.assignedTo),
      assignedName: nameFor(String(item.assignedTo)), startAt: toISOString(item.startAt) ?? '', endAt: toISOString(item.endAt) ?? '',
      timezone: validScheduleTimezone(item.timezone) ? String(item.timezone) : 'UTC',
      plannedHours: Number(item.plannedHours) || 0, status: item.status === 'cancelled' ? 'cancelled' as const : 'scheduled' as const,
    };
  });
  const blocks = blockSnapshot.docs.map((document) => {
    const item = document.data();
    return {
      id: document.id, groupId: String(item.groupId), atelierId: identity.atelierId, memberId: String(item.memberId),
      memberName: nameFor(String(item.memberId)), date: String(item.date), endDate: String(item.endDate),
      startMinute: Number(item.startMinute), endMinute: Number(item.endMinute), allDay: item.allDay === true,
      type: String(item.type), title: String(item.title), status: item.status === 'cancelled' ? 'cancelled' as const : 'active' as const,
    };
  });
  const orderRefs = [...new Map(stageSnapshot.docs.flatMap((stage) => {
    const orderRef = stage.ref.parent.parent;
    return orderRef && orderRef.path.startsWith(`ateliers/${identity.atelierId}/orders/`) ? [[orderRef.path, orderRef] as const] : [];
  })).values()];
  const orderSnapshots = [];
  for (let offset = 0; offset < orderRefs.length; offset += 100) orderSnapshots.push(...await adminDb.getAll(...orderRefs.slice(offset, offset + 100)));
  const orders = new Map(orderSnapshots.filter((snapshot) => snapshot.exists).map((snapshot) => [snapshot.ref.path, snapshot.data()!]));
  const activeOrderIds = [...new Set(stageSnapshot.docs.flatMap((stage) => {
    const orderRef = stage.ref.parent.parent;
    const order = orderRef ? orders.get(orderRef.path) : undefined;
    return orderRef && order && activeOrderStatuses.has(String(order.status)) ? [orderRef.id] : [];
  }))];
  const orderIdChunks: string[][] = [];
  for (let offset = 0; offset < activeOrderIds.length; offset += 30) orderIdChunks.push(activeOrderIds.slice(offset, offset + 30));
  const [relatedEventSnapshots, scheduledOrderSlotSnapshots] = await Promise.all([
    Promise.all(orderIdChunks.map((orderIds) => atelier.collection('events')
      .where('orderId', 'in', orderIds).where('status', '==', 'active').limit(501).get())),
    Promise.all(orderIdChunks.map((orderIds) => slotCollection
      .where('orderId', 'in', orderIds).where('status', '==', 'scheduled').limit(501).get())),
  ]);
  if (relatedEventSnapshots.some((snapshot) => snapshot.size > 500) || scheduledOrderSlotSnapshots.some((snapshot) => snapshot.size > 500)) {
    throw new HttpsError('resource-exhausted', 'Há muitos eventos ou alocações vinculados a pedidos para avaliar riscos com segurança.');
  }
  const relatedEventsByOrder = new Map<string, FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[]>();
  for (const document of relatedEventSnapshots.flatMap((snapshot) => snapshot.docs)) {
    const orderId = typeof document.get('orderId') === 'string' ? String(document.get('orderId')) : '';
    if (!orderId) continue;
    const current = relatedEventsByOrder.get(orderId) ?? [];
    current.push(document);
    relatedEventsByOrder.set(orderId, current);
  }
  const scheduledSlotsByStage = new Map<string, FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[]>();
  for (const document of scheduledOrderSlotSnapshots.flatMap((snapshot) => snapshot.docs)) {
    const orderId = typeof document.get('orderId') === 'string' ? String(document.get('orderId')) : '';
    const stageId = typeof document.get('stageId') === 'string' ? String(document.get('stageId')) : '';
    if (!orderId || !stageId) continue;
    const key = `${orderId}/${stageId}`;
    const current = scheduledSlotsByStage.get(key) ?? [];
    current.push(document);
    scheduledSlotsByStage.set(key, current);
  }
  const stageRows = stageSnapshot.docs.flatMap((stageDoc) => {
    const orderRef = stageDoc.ref.parent.parent;
    const order = orderRef ? orders.get(orderRef.path) : undefined;
    if (!order || finalOrderStatuses.has(String(order.status)) || !activeOrderStatuses.has(String(order.status))) return [];
    const stage = stageDoc.data();
    const orderId = orderRef!.id;
    const stageId = stageDoc.id;
    const relatedEvents = relatedEventsByOrder.get(orderId) ?? [];
    const openStages = stageSnapshot.docs.filter((candidate) => candidate.ref.parent.parent?.path === orderRef!.path)
      .map((candidate) => ({
        id: candidate.id,
        status: String(candidate.get('status')),
        deadline: candidate.get('deadline'),
        assignedTo: candidate.get('assignedTo'),
      })).filter((candidate) => !completedStageStatuses.has(candidate.status));
    const stageSlots = slots.filter((slot) => slot.orderId === orderId && slot.stageId === stageId && slot.status === 'scheduled');
    const riskEventDates = [
      ...(typeof order.eventDate === 'string' ? [order.eventDate] : []),
      ...relatedEvents.filter((event) => ['cosplay', 'convention'].includes(String(event.get('type')))
        && typeof event.get('startDate') === 'string').map((event) => String(event.get('startDate'))),
    ].filter((date) => parseScheduleDate(date) !== null).sort();
    const linkedDeadlines = relatedEvents.filter((event) => ['deadline', 'prop_deadline'].includes(String(event.get('type')))
      && typeof event.get('startDate') === 'string').map((event) => String(event.get('startDate')));
    const lateScheduledStageCount = openStages.filter((openStage) => {
      const stageDeadlines = [
        ...(typeof openStage.deadline === 'string' ? [openStage.deadline] : []),
        ...linkedDeadlines,
      ].filter((deadline) => parseScheduleDate(deadline) !== null);
      if (!stageDeadlines.length) return false;
      return (scheduledSlotsByStage.get(`${orderId}/${openStage.id}`) ?? []).some((slot) =>
        typeof slot.get('date') === 'string' && stageDeadlines.some((deadline) => String(slot.get('date')) > deadline));
    }).length;
    const risk = scheduleRisk({
      deliveryDate: typeof order.expectedDeliveryDate === 'string' ? order.expectedDeliveryDate : null,
      eventDate: riskEventDates[0] ?? null,
      orderStatus: String(order.status),
      openStageDeadlines: [
        ...openStages.flatMap((candidate) => typeof candidate.deadline === 'string' ? [candidate.deadline] : []),
        ...linkedDeadlines,
      ],
      openStageCount: openStages.length,
      scheduledStageIds: openStages.filter((candidate) => (scheduledSlotsByStage.get(`${orderId}/${candidate.id}`)?.length ?? 0) > 0).map((candidate) => candidate.id),
      lateScheduledStageCount,
    }, currentDate(String(identity.atelier.timezone ?? 'America/Sao_Paulo')));
    return [{
      id: stageId, orderId, character: String(order.character ?? ''),
      clientName: schedulingPermission(identity.member, 'orders:read') ? String(order.clientName ?? '') : '',
      status: String(stage.status), progress: Number(stage.progress) || 0,
      deadline: typeof stage.deadline === 'string' ? stage.deadline : null,
      assignedTo: typeof stage.assignedTo === 'string' ? stage.assignedTo : null,
      scheduledHours: stageSlots.reduce((sum, slot) => sum + slot.plannedHours, 0),
      riskLevel: risk.level, riskReasons: risk.reasons,
    }];
  });
  const events = eventSnapshot ? eventSnapshot.docs.flatMap((document) => {
    const event = document.data();
    if (event.status !== 'active' || event.startDate > toDate) return [];
    return [{ id: document.id, atelierId: identity.atelierId, title: String(event.title), type: String(event.type),
      startDate: String(event.startDate), endDate: String(event.endDate), orderId: typeof event.orderId === 'string' ? event.orderId : null,
      notes: String(event.notes ?? ''), status: 'active' as const, createdBy: String(event.createdBy ?? ''),
      createdAt: toISOString(event.createdAt), updatedAt: toISOString(event.updatedAt) }];
  }) : [];
  const capacityByDate = memberList.flatMap((member) => dates.map((date) => {
    const dailyCapacity = Number(member.weeklyHoursByWeekday[String(scheduleWeekday(date))] ?? 0);
    const dailySlots = slots.filter((slot) => slot.assignedTo === member.memberId && slot.date === date && slot.status === 'scheduled');
    const dailyBlocks = blocks.filter((block) => block.memberId === member.memberId && block.date === date && block.status === 'active');
    const blockedHours = dailyBlocks.reduce((sum, block) => sum + (block.allDay ? dailyCapacity : (block.endMinute - block.startMinute) / 60), 0);
    return { memberId: member.memberId, date, capacityHours: dailyCapacity, allocatedHours: dailySlots.reduce((sum, slot) => sum + slot.plannedHours, 0), blockedHours: Math.min(dailyCapacity, blockedHours) };
  }));
  return { fromDate, toDate, members: memberList, slots, blocks, stages: stageRows, events, capacityByDate };
});
