import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const requireFromFunctions = createRequire(new URL('../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFromFunctions('firebase-admin/app');
const { getAuth: getAdminAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
const projectId = 'demo-cosmaker';
const nonce = randomUUID().slice(0, 8);
const adminApp = initializeAdminApp({ projectId }, `schedule-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const clientApp = initializeApp({
  apiKey: 'emulator-only-key', authDomain: `${projectId}.firebaseapp.com`, projectId,
  appId: 'emulator-only-app',
}, `schedule-client-${nonce}`);
const auth = getAuth(clientApp);
const functions = getFunctions(clientApp, 'us-central1');
const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
connectAuthEmulator(auth, `http://${emulatorHost}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFunctionsEmulator(functions, emulatorHost, Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001));

type Identity = { email: string; password: string; uid: string };
type SlotRequest = { requestId: string; orderId: string; stageId: string; assignedTo: string; startAt: string; endAt: string; plannedHours: number };
type QuerySnapshotLike = { docs: Array<{ data(): Record<string, unknown>; ref: { delete(): Promise<unknown> } }> };
const createdUids: string[] = [];
const createdAteliers: string[] = [];
let ownerA: Identity;
let ownerB: Identity;
let memberA: Identity;
let readerA: Identity;
let atelierA: string;
let atelierB: string;

async function createIdentity(name: string): Promise<Identity> {
  const email = `${name}-${nonce}@cosmaker.test`;
  const password = `Local!${randomUUID().slice(0, 14)}aA1`;
  const user = await adminAuth.createUser({ email, password, displayName: name, emailVerified: true });
  createdUids.push(user.uid);
  return { email, password, uid: user.uid };
}

async function createAtelier(label: string) {
  const owner = await createIdentity(`owner-${label}`);
  const atelierId = `schedule-${nonce}-${label}`;
  createdAteliers.push(atelierId);
  await Promise.all([
    adminDb.doc(`users/${owner.uid}`).set({ id: owner.uid, email: owner.email, name: label, accountType: 'atelier_member', atelierId, role: 'owner', permissions: [], active: true }),
    adminDb.doc(`ateliers/${atelierId}`).set({ id: atelierId, name: `Synthetic ${label}`, ownerId: owner.uid, active: true, timezone: 'America/Sao_Paulo' }),
    adminDb.doc(`ateliers/${atelierId}/members/${owner.uid}`).set({ userId: owner.uid, role: 'owner', permissions: [], active: true }),
  ]);
  return { atelierId, owner };
}

async function addMember(atelierId: string, identity: Identity, permissions: string[]) {
  await Promise.all([
    adminDb.doc(`users/${identity.uid}`).set({ id: identity.uid, email: identity.email, name: identity.email, accountType: 'atelier_member', atelierId, role: 'assistant', permissions, active: true }),
    adminDb.doc(`ateliers/${atelierId}/members/${identity.uid}`).set({ userId: identity.uid, role: 'assistant', permissions, active: true }),
  ]);
}

async function signIn(identity: Identity) {
  await signOut(auth).catch(() => undefined);
  await signInWithEmailAndPassword(auth, identity.email, identity.password);
  await auth.currentUser?.getIdToken(true);
}

function call<T>(name: string, data: Record<string, unknown> = {}) {
  return httpsCallable<Record<string, unknown>, T>(functions, name)(data).then((result) => result.data);
}

function nextMonday() {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 7);
  while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function daysAfter(date: string, days: number) {
  const result = new Date(`${date}T12:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function makeSlot(id: string, orderId: string, stageId: string, date: string, startHour: number, hours: number): SlotRequest {
  const startAt = new Date(`${date}T${String(startHour + 3).padStart(2, '0')}:00:00.000Z`);
  const endAt = new Date(startAt.getTime() + Math.max(1, hours) * 60 * 60 * 1000);
  return { requestId: id, orderId, stageId, assignedTo: memberA.uid, startAt: startAt.toISOString(), endAt: endAt.toISOString(), plannedHours: hours };
}

async function seedOrder(atelierId: string, orderId: string, stageId: string, eventDate: string) {
  await Promise.all([
    adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`).set({
      atelierId, status: 'confirmed', character: `Synthetic ${orderId}`, clientName: 'Cliente fictícia',
      expectedDeliveryDate: daysAfter(eventDate, 2), eventDate, amountRemaining: 0,
    }),
    adminDb.doc(`ateliers/${atelierId}/orders/${orderId}/productionStages/${stageId}`).set({
      atelierId, orderId, name: 'Modelagem', order: 1, status: 'pending', progress: 0, assignedTo: null, deadline: eventDate,
    }),
  ]);
}

beforeAll(async () => {
  const first = await createAtelier('a');
  const second = await createAtelier('b');
  ownerA = first.owner; ownerB = second.owner;
  atelierA = first.atelierId; atelierB = second.atelierId;
  memberA = await createIdentity('scheduler');
  readerA = await createIdentity('schedule-reader');
  await Promise.all([
    addMember(atelierA, memberA, ['schedule:read', 'schedule:write']),
    addMember(atelierA, readerA, ['schedule:read']),
  ]);
}, 60000);

afterAll(async () => {
  await signOut(auth).catch(() => undefined);
  await Promise.all(createdAteliers.map((id) => adminDb.recursiveDelete(adminDb.doc(`ateliers/${id}`)).catch(() => undefined)));
  const audits: Array<QuerySnapshotLike | null> = await Promise.all(createdAteliers.map((id) => adminDb.collection('auditLogs').where('atelierId', '==', id).get().catch(() => null)));
  await Promise.all(audits.flatMap((snapshot) => snapshot?.docs ?? []).map((document) => document.ref.delete()));
  await Promise.all(createdUids.map((uid) => adminDb.doc(`users/${uid}`).delete().catch(() => undefined)));
  await Promise.all(createdUids.map((uid) => adminAuth.deleteUser(uid).catch(() => undefined)));
  await deleteApp(clientApp).catch(() => undefined);
  await adminApp.delete().catch(() => undefined);
});

describe('Scheduling Functions em Firebase Emulator', () => {
  it('mantém prazos coerentes com início/slots e libera capacidade futura sem alterar etapa congelada', async () => {
    await signIn(ownerA);
    const date = daysAfter(nextMonday(), 28);
    const laterDate = daysAfter(date, 7);
    const finalDate = daysAfter(date, 14);
    await call('saveMemberScheduleCapacity', { memberId: memberA.uid, weeklyHoursByWeekday: { '0': 0, '1': 8, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 }, workdayStartMinute: 480, workdayEndMinute: 1020, timezone: 'America/Sao_Paulo' });
    await seedOrder(atelierA, 'order-dates', 'stage-dates', finalDate);
    const stageRef = adminDb.doc(`ateliers/${atelierA}/orders/order-dates/productionStages/stage-dates`);
    await stageRef.update({ plannedStartDate: date });
    const first = { ...makeSlot('slot-dates-first', 'order-dates', 'stage-dates', laterDate, 8, 1), deadline: finalDate };
    await call('allocateProductionTime', first as unknown as Record<string, unknown>);
    await expect(call('allocateProductionTime', { ...first, deadline: laterDate })).rejects.toMatchObject({ code: 'functions/already-exists' });
    await expect(call('allocateProductionTime', { ...makeSlot('slot-dates-before-start', 'order-dates', 'stage-dates', daysAfter(date, -7), 8, 1), deadline: finalDate })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await expect(call('allocateProductionTime', { ...makeSlot('slot-dates-narrowing', 'order-dates', 'stage-dates', date, 8, 1), deadline: date })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect((await stageRef.get()).get('deadline')).toBe(finalDate);
    await call('allocateProductionTime', { ...makeSlot('slot-dates-allowed', 'order-dates', 'stage-dates', date, 8, 1), deadline: finalDate });

    for (const [index, status] of ['waiting_approval', 'completed', 'approved'].entries()) {
      const orderId = `order-frozen-${status}`; const stageId = `stage-frozen-${status}`;
      await seedOrder(atelierA, orderId, stageId, finalDate);
      const slot = makeSlot(`slot-frozen-${status}`, orderId, stageId, date, 12 + index, 1);
      await call('allocateProductionTime', slot as unknown as Record<string, unknown>);
      const frozenRef = adminDb.doc(`ateliers/${atelierA}/orders/${orderId}/productionStages/${stageId}`);
      await frozenRef.update({ status, pendingApprovalId: status === 'waiting_approval' ? 'approval-frozen' : null });
      const approvalRef = adminDb.doc(`ateliers/${atelierA}/orders/${orderId}/approvals/approval-frozen`);
      await approvalRef.set({ stageId, status: status === 'waiting_approval' ? 'pending' : 'approved', stageSnapshot: { assignedTo: memberA.uid, deadline: finalDate } });
      const before = (await frozenRef.get()).data(); const approvalBefore = (await approvalRef.get()).data();
      await expect(call('allocateProductionTime', { ...makeSlot(`slot-frozen-extra-${index}`, orderId, stageId, laterDate, 12 + index, 1) })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
      expect(await call('cancelProductionSlot', { slotId: slot.requestId })).toMatchObject({ status: 'cancelled' });
      expect((await frozenRef.get()).data()).toEqual(before);
      expect((await approvalRef.get()).data()).toEqual(approvalBefore);
      expect((await adminDb.doc(`ateliers/${atelierA}/productionSlots/${slot.requestId}`).get()).get('status')).toBe('cancelled');
    }
    const workspace = await call<{ capacityByDate: Array<{ memberId: string; date: string; allocatedHours: number }> }>('listScheduleWorkspace', { fromDate: date, toDate: laterDate });
    expect(workspace.capacityByDate.find((item) => item.memberId === memberA.uid && item.date === date)?.allocatedHours).toBe(1);
  }, 120000);

  it('salva capacidade, serializa alocações concorrentes, aplica bloqueios e mantém os efeitos auditáveis', async () => {
    const date = nextMonday();
    const weeklyHoursByWeekday = { '0': 0, '1': 4, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };
    const secondDate = daysAfter(date, 7);
    await Promise.all([
      seedOrder(atelierA, 'order-one', 'stage-one', daysAfter(date, 14)),
      seedOrder(atelierA, 'order-two', 'stage-two', daysAfter(date, 14)),
      seedOrder(atelierA, 'order-three', 'stage-three', daysAfter(date, 14)),
      seedOrder(atelierA, 'order-four', 'stage-four', daysAfter(secondDate, 14)),
    ]);
    await signIn(ownerA);
    await call('saveMemberScheduleCapacity', {
      memberId: memberA.uid, weeklyHoursByWeekday, workdayStartMinute: 480,
      workdayEndMinute: 1020, timezone: 'America/Sao_Paulo',
    });
    expect((await adminDb.doc(`ateliers/${atelierA}/teamCapacity/${memberA.uid}`).get()).data()?.weeklyHoursByWeekday).toEqual(weeklyHoursByWeekday);

    const first = makeSlot('slot-concurrent-1', 'order-one', 'stage-one', date, 8, 2);
    const second = makeSlot('slot-concurrent-2', 'order-two', 'stage-two', date, 8, 2);
    const race = await Promise.allSettled([
      call('allocateProductionTime', first as unknown as Record<string, unknown>),
      call('allocateProductionTime', second as unknown as Record<string, unknown>),
    ]);
    expect(race.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(race.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const winner = race.find((result): result is PromiseFulfilledResult<unknown> => result.status === 'fulfilled')!;
    const winnerInput = (winner === race[0] ? first : second);
    await expect(call<{ alreadyCreated: boolean }>('allocateProductionTime', winnerInput as unknown as Record<string, unknown>))
      .resolves.toMatchObject({ alreadyCreated: true, status: 'scheduled' });

    const nextSlot = winnerInput.orderId === 'order-one'
      ? makeSlot('slot-next-1', 'order-three', 'stage-three', date, 11, 2)
      : makeSlot('slot-next-1', 'order-one', 'stage-one', date, 11, 2);
    await call('allocateProductionTime', nextSlot as unknown as Record<string, unknown>);
    const excess = makeSlot('slot-excess-1', 'order-four', 'stage-four', date, 14, 0.25);
    await expect(call('allocateProductionTime', excess as unknown as Record<string, unknown>))
      .rejects.toMatchObject({ code: 'functions/failed-precondition' });

    const overlap = makeSlot('slot-overlap-1', 'order-four', 'stage-four', date, 9, 0.25);
    await expect(call('allocateProductionTime', overlap as unknown as Record<string, unknown>)).rejects.toBeTruthy();
    const storedSlots = await adminDb.collection(`ateliers/${atelierA}/productionSlots`).where('date', '==', date).where('status', '==', 'scheduled').get();
    expect(storedSlots.size).toBe(2);
    const projected = await call<{ slots: Array<{ id: string; timezone: string; startAt: string }> }>('listScheduleWorkspace', { fromDate: date, toDate: date });
    expect(projected.slots.find((slot) => slot.id === winnerInput.requestId)).toMatchObject({ timezone: 'America/Sao_Paulo' });
    await storedSlots.docs[0].ref.update({ timezone: null });
    const legacy = await call<{ slots: Array<{ id: string; timezone: string }> }>('listScheduleWorkspace', { fromDate: date, toDate: date });
    expect(legacy.slots.find((slot) => slot.id === storedSlots.docs[0].id)?.timezone).toBe('UTC');
    await storedSlots.docs[0].ref.update({ timezone: 'America/Sao_Paulo' });
    const assignedStage = (await adminDb.doc(`ateliers/${atelierA}/orders/${winnerInput.orderId}/productionStages/${winnerInput.stageId}`).get()).data();
    expect(assignedStage?.assignedTo).toBe(memberA.uid);
    expect((await adminDb.doc(`ateliers/${atelierA}/orders/${winnerInput.orderId}`).get()).data()?.status).toBe('scheduled');

    await expect(call('createScheduleBlock', {
      requestId: 'block-overlap-1', memberId: memberA.uid, startDate: date, endDate: date,
      startMinute: 540, endMinute: 570, allDay: false, type: 'pause', title: 'Pausa fictícia',
    })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await expect(call('createScheduleBlock', {
      requestId: 'block-over-cap-1', memberId: memberA.uid, startDate: date, endDate: date,
      startMinute: 900, endMinute: 960, allDay: false, type: 'pause', title: 'Pausa fictícia',
    })).rejects.toMatchObject({ code: 'functions/failed-precondition' });

    await call('cancelProductionSlot', { slotId: winnerInput.requestId });
    const block = await call<{ groupId: string }>('createScheduleBlock', {
      requestId: 'block-future-1', memberId: memberA.uid, startDate: secondDate, endDate: secondDate,
      startMinute: 540, endMinute: 600, allDay: false, type: 'pause', title: 'Pausa fictícia',
    });
    expect(block.groupId).toBe('block-future-1');
    await expect(call('allocateProductionTime', {
      ...makeSlot('slot-blocked-1', 'order-four', 'stage-four', secondDate, 9, 1),
    } as unknown as Record<string, unknown>)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await call('cancelScheduleBlock', { groupId: block.groupId });
    expect((await adminDb.doc(`ateliers/${atelierA}/scheduleBlocks/block-future-1-${secondDate}`).get()).data()?.status).toBe('cancelled');

    const eventDate = daysAfter(date, 12);
    const createdEvent = await call<{ eventId: string; alreadyCreated: boolean }>('createAtelierEvent', {
      requestId: 'event-cosplay-1', title: 'Convenção fictícia', type: 'convention',
      startDate: eventDate, endDate: eventDate, orderId: 'order-one', notes: 'Evento de teste no Emulator.',
    });
    expect(createdEvent.alreadyCreated).toBe(false);
    await adminDb.doc(`ateliers/${atelierA}/orders/order-one`).update({
      eventDate: null, expectedDeliveryDate: daysAfter(date, 25),
    });
    const riskWithEvent = await call<{ stages: Array<{ orderId: string; riskReasons: string[] }> }>(
      'listScheduleWorkspace', { fromDate: date, toDate: daysAfter(date, 30) },
    );
    expect(riskWithEvent.stages.find((stage) => stage.orderId === 'order-one')?.riskReasons)
      .toContain('A entrega prevista ocorre depois do evento informado.');
    await expect(call('createAtelierEvent', {
      requestId: 'event-cosplay-1', title: 'Convenção fictícia', type: 'convention',
      startDate: eventDate, endDate: eventDate, orderId: 'order-one', notes: 'Evento de teste no Emulator.',
    })).resolves.toMatchObject({ alreadyCreated: true });
    const listed = await call<{ events: Array<{ id: string }> }>('listAtelierEvents', { fromDate: date, toDate: daysAfter(date, 30) });
    expect(listed.events.map((event) => event.id)).toContain('event-cosplay-1');
    await call('updateAtelierEvent', {
      eventId: createdEvent.eventId, title: 'Convenção revisada', type: 'convention',
      startDate: eventDate, endDate: eventDate, orderId: 'order-one', notes: '',
    });
    expect((await adminDb.doc(`ateliers/${atelierA}/events/${createdEvent.eventId}`).get()).data()?.title).toBe('Convenção revisada');
    await call('cancelAtelierEvent', { eventId: createdEvent.eventId });
    expect((await adminDb.doc(`ateliers/${atelierA}/events/${createdEvent.eventId}`).get()).data()?.status).toBe('cancelled');
    const riskAfterCancel = await call<{ stages: Array<{ orderId: string; riskReasons: string[] }> }>(
      'listScheduleWorkspace', { fromDate: date, toDate: daysAfter(date, 30) },
    );
    expect(riskAfterCancel.stages.find((stage) => stage.orderId === 'order-one')?.riskReasons)
      .not.toContain('A entrega prevista ocorre depois do evento informado.');

    const audits: QuerySnapshotLike = await adminDb.collection('auditLogs').where('atelierId', '==', atelierA).get();
    expect(audits.docs.some((document) => document.data().action === 'schedule.production_time_allocated')).toBe(true);
    expect(audits.docs.some((document) => document.data().action === 'schedule.block_created')).toBe(true);
    expect(audits.docs.some((document) => document.data().action === 'schedule.event_created')).toBe(true);
  }, 120000);

  it('aplica permissões e isolamento entre tenants para agenda e eventos', async () => {
    const date = nextMonday();
    await signIn(readerA);
    await expect(call('listScheduleWorkspace', { fromDate: date, toDate: daysAfter(date, 7) }))
      .resolves.toMatchObject({ fromDate: date });
    await expect(call('saveMemberScheduleCapacity', {
      memberId: readerA.uid, weeklyHoursByWeekday: { '0': 0, '1': 1, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 },
      workdayStartMinute: 480, workdayEndMinute: 1020, timezone: 'America/Sao_Paulo',
    })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await expect(call('listAtelierEvents', { fromDate: date, toDate: daysAfter(date, 7) }))
      .rejects.toMatchObject({ code: 'functions/permission-denied' });

    await signIn(ownerB);
    const otherTenant = await call<{ slots: Array<{ id: string }>; events: Array<{ id: string }> }>('listScheduleWorkspace', { fromDate: date, toDate: daysAfter(date, 7) });
    expect(otherTenant.slots).toHaveLength(0);
    expect(otherTenant.events).toHaveLength(0);
    await expect(call('cancelProductionSlot', { slotId: 'slot-concurrent-2' }))
      .rejects.toMatchObject({ code: 'functions/not-found' });
    const events = await call<{ events: unknown[] }>('listAtelierEvents', { fromDate: date, toDate: daysAfter(date, 30) });
    expect(events.events).toHaveLength(0);
    expect(atelierA).not.toBe(atelierB);
  }, 120000);
});
