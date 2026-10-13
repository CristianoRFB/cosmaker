import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireTenantWorkspaceIdentity } from '../commercial/access';
import { buildClientSearchPrefixes, clientEmailIndexId, normalizeClientSearch } from './client-data';

type ClientPermission = 'clients:read' | 'clients:write';
type ClientRelatedRecord = { id: string; createdAt?: unknown; updatedAt?: unknown; [key: string]: unknown };

function record(data: unknown) {
  return data !== null && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {};
}

function validDocumentId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 150 && !value.includes('/');
}

function isoDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return typeof value === 'string' ? value : null;
}

function clientView(id: string, data: Record<string, unknown>) {
  return {
    id,
    hasLinkedAccount: typeof data.userId === 'string' && data.userId.length > 0,
    name: typeof data.name === 'string' ? data.name : 'Cliente sem nome',
    email: typeof data.email === 'string' ? data.email : '',
    phone: typeof data.phone === 'string' ? data.phone : '',
    createdAt: isoDate(data.createdAt),
    updatedAt: isoDate(data.updatedAt),
  };
}

async function requireClientWorkspace(uid: string, claims: Record<string, unknown>, permission: ClientPermission) {
  const identity = await requireTenantWorkspaceIdentity(uid, claims);
  const member = identity.member;
  const granted = member.role === 'owner'
    || member.role === 'admin'
    || (Array.isArray(member.permissions) && (
      member.permissions.includes(permission)
      || (permission === 'clients:read' && member.permissions.includes('clients:write'))
    ));
  if (!granted) throw new HttpsError('permission-denied', 'Seu perfil não tem permissão para acessar os clientes deste ateliê.');
  return identity;
}

function assertOnlyKeys(data: Record<string, unknown>, keys: string[]) {
  if (Object.keys(data).some((key) => !keys.includes(key))) throw new HttpsError('invalid-argument', 'A solicitação contém campos não aceitos.');
}

export const listAtelierClients = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para consultar clientes.');
  const identity = await requireClientWorkspace(call.auth.uid, call.auth.token, 'clients:read');
  const data = record(call.data);
  assertOnlyKeys(data, ['search', 'cursor', 'limit']);

  const requestedLimit = Number(data.limit);
  const pageSize = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 25;
  const search = typeof data.search === 'string' ? normalizeClientSearch(data.search) : '';
  if (search.length > 64) throw new HttpsError('invalid-argument', 'A busca deve ter até 64 caracteres.');
  const cursor = data.cursor === undefined || data.cursor === null || data.cursor === '' ? null : data.cursor;
  if (cursor !== null && !validDocumentId(cursor)) throw new HttpsError('invalid-argument', 'O cursor da lista é inválido.');

  const clients = adminDb.collection(`ateliers/${identity.atelierId}/clients`);
  let query = search
    ? clients.where('searchPrefixes', 'array-contains', search).orderBy('name')
    : clients.orderBy('name');
  if (cursor) {
    const cursorSnapshot = await clients.doc(cursor).get();
    if (!cursorSnapshot.exists) throw new HttpsError('invalid-argument', 'O cursor da lista expirou. Atualize a página.');
    query = query.startAfter(cursorSnapshot);
  }
  const result = await query.limit(pageSize + 1).get();
  const hasMore = result.docs.length > pageSize;
  const page = result.docs.slice(0, pageSize);
  return {
    clients: page.map((snapshot) => clientView(snapshot.id, snapshot.data())),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
});

export const saveAtelierClient = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para salvar o cadastro.');
  const identity = await requireClientWorkspace(call.auth.uid, call.auth.token, 'clients:write');
  const data = record(call.data);
  assertOnlyKeys(data, ['clientId', 'name', 'email', 'phone']);

  const clientId = data.clientId === undefined || data.clientId === null || data.clientId === '' ? null : data.clientId;
  if (clientId !== null && !validDocumentId(clientId)) throw new HttpsError('invalid-argument', 'O identificador do cliente é inválido.');
  const name = typeof data.name === 'string' ? data.name.trim().replace(/\s+/g, ' ') : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const phone = typeof data.phone === 'string' ? data.phone.trim().replace(/[\s()-]/g, '') : '';
  if (name.length < 2 || name.length > 120) throw new HttpsError('invalid-argument', 'Informe um nome entre 2 e 120 caracteres.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'Informe um e-mail válido.');
  if (phone.length > 32 || (phone && !/^\+?[0-9.]{7,32}$/.test(phone))) throw new HttpsError('invalid-argument', 'Informe um telefone válido ou deixe o campo vazio.');

  const clients = adminDb.collection(`ateliers/${identity.atelierId}/clients`);
  const clientRef = clientId ? clients.doc(clientId) : clients.doc();
  const newEmailIndexRef = adminDb.doc(`ateliers/${identity.atelierId}/clientEmailIndex/${clientEmailIndexId(email)}`);
  const auditRef = adminDb.collection('auditLogs').doc();

  await adminDb.runTransaction(async (transaction) => {
    const clientSnapshot = await transaction.get(clientRef);
    if (clientId && !clientSnapshot.exists) throw new HttpsError('not-found', 'O cliente não foi encontrado neste ateliê.');
    const existing = clientSnapshot.data() ?? {};
    const oldEmail = typeof existing.email === 'string' ? existing.email.trim().toLowerCase() : '';
    if (typeof existing.userId === 'string' && oldEmail && oldEmail !== email) {
      throw new HttpsError('failed-precondition', 'O e-mail de uma conta vinculada só pode ser alterado após nova verificação de identidade.');
    }

    const previousEmailIndexRef = oldEmail && oldEmail !== email
      ? adminDb.doc(`ateliers/${identity.atelierId}/clientEmailIndex/${clientEmailIndexId(oldEmail)}`)
      : null;
    const [emailIndexSnapshot, previousEmailIndexSnapshot, legacyMatches] = await Promise.all([
      transaction.get(newEmailIndexRef),
      previousEmailIndexRef ? transaction.get(previousEmailIndexRef) : Promise.resolve(null),
      transaction.get(clients.where('email', '==', email).limit(2)),
    ]);

    const indexedClientId = emailIndexSnapshot.data()?.clientId;
    if (emailIndexSnapshot.exists && indexedClientId !== clientRef.id) {
      throw new HttpsError('already-exists', 'Já existe um cadastro com este e-mail neste ateliê.');
    }
    const legacyCollision = legacyMatches.docs.find((snapshot) => snapshot.id !== clientRef.id);
    if (legacyCollision) throw new HttpsError('already-exists', 'Já existe um cadastro com este e-mail neste ateliê.');
    if (previousEmailIndexSnapshot?.exists && previousEmailIndexSnapshot.data()?.clientId !== clientRef.id) {
      throw new HttpsError('failed-precondition', 'O índice de e-mail do cadastro precisa ser revisado antes da alteração.');
    }

    const now = FieldValue.serverTimestamp();
    const changedFields = [
      ...(!clientSnapshot.exists || existing.name !== name ? ['name'] : []),
      ...(!clientSnapshot.exists || oldEmail !== email ? ['email'] : []),
      ...(!clientSnapshot.exists || (typeof existing.phone === 'string' ? existing.phone : '') !== phone ? ['phone'] : []),
    ];
    const payload = {
      id: clientRef.id,
      name,
      nameSearch: normalizeClientSearch(name),
      email,
      emailSearch: normalizeClientSearch(email),
      searchPrefixes: buildClientSearchPrefixes(name, email),
      phone,
      updatedAt: now,
      ...(!clientSnapshot.exists ? { createdAt: now, totalSpent: 0, orderCount: 0 } : {}),
    };
    transaction.set(clientRef, payload, { merge: true });
    transaction.set(newEmailIndexRef, { clientId: clientRef.id, updatedAt: now });
    if (previousEmailIndexRef && previousEmailIndexSnapshot?.exists) transaction.delete(previousEmailIndexRef);
    transaction.create(auditRef, {
      actorId: call.auth!.uid,
      atelierId: identity.atelierId,
      action: clientSnapshot.exists ? 'client.updated' : 'client.created',
      entity: 'client',
      entityId: clientRef.id,
      before: clientSnapshot.exists ? { changedFields } : null,
      after: { changedFields },
      timestamp: now,
    });
  });

  return { clientId: clientRef.id };
});

export const addAtelierClientInteraction = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para registrar uma interação.');
  const identity = await requireClientWorkspace(call.auth.uid, call.auth.token, 'clients:write');
  const data = record(call.data);
  assertOnlyKeys(data, ['clientId', 'requestId', 'note']);
  if (!validDocumentId(data.clientId) || !validDocumentId(data.requestId)) throw new HttpsError('invalid-argument', 'Cliente e identificador da interação são obrigatórios.');
  const note = typeof data.note === 'string' ? data.note.trim() : '';
  if (note.length < 2 || note.length > 2000) throw new HttpsError('invalid-argument', 'A interação deve ter entre 2 e 2.000 caracteres.');

  const clientRef = adminDb.doc(`ateliers/${identity.atelierId}/clients/${data.clientId}`);
  const interactionRef = clientRef.collection('interactions').doc(data.requestId);
  const auditRef = adminDb.collection('auditLogs').doc();
  await adminDb.runTransaction(async (transaction) => {
    const [clientSnapshot, interactionSnapshot] = await Promise.all([transaction.get(clientRef), transaction.get(interactionRef)]);
    if (!clientSnapshot.exists) throw new HttpsError('not-found', 'O cliente não foi encontrado neste ateliê.');
    if (interactionSnapshot.exists) return;
    const now = FieldValue.serverTimestamp();
    transaction.create(interactionRef, { type: 'note', note, actorId: call.auth!.uid, createdAt: now });
    transaction.create(auditRef, {
      actorId: call.auth!.uid,
      atelierId: identity.atelierId,
      action: 'client.interaction_created',
      entity: 'client_interaction',
      entityId: interactionRef.id,
      after: { clientId: clientRef.id, type: 'note' },
      timestamp: now,
    });
  });
  return { interactionId: interactionRef.id };
});

export const getAtelierClient = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para consultar o cliente.');
  const identity = await requireClientWorkspace(call.auth.uid, call.auth.token, 'clients:read');
  const data = record(call.data);
  assertOnlyKeys(data, ['clientId']);
  if (!validDocumentId(data.clientId)) throw new HttpsError('invalid-argument', 'O identificador do cliente é inválido.');
  const clientRef = adminDb.doc(`ateliers/${identity.atelierId}/clients/${data.clientId}`);
  const clientSnapshot = await clientRef.get();
  if (!clientSnapshot.exists) throw new HttpsError('not-found', 'O cliente não foi encontrado neste ateliê.');
  const client = clientSnapshot.data()!;
  const email = typeof client.email === 'string' ? client.email.trim().toLowerCase() : '';
  const collection = (name: string) => adminDb.collection(`ateliers/${identity.atelierId}/${name}`);
  const canRead = (permission: string) => identity.member.role === 'owner'
    || identity.member.role === 'admin'
    || (Array.isArray(identity.member.permissions) && (
      identity.member.permissions.includes(permission)
      || (permission === 'quotes:read' && identity.member.permissions.includes('quotes:write'))
      || (permission === 'orders:read' && identity.member.permissions.includes('orders:manage'))
    ));

  const findRelated = async (name: string): Promise<ClientRelatedRecord[]> => {
    const target = collection(name);
    const byClient = await target.where('clientId', '==', clientRef.id).limit(50).get();
    const byEmail = email ? await target.where('email', '==', email).limit(50).get() : null;
    const unique = new Map([...byClient.docs, ...(byEmail?.docs ?? [])].map((snapshot) => [snapshot.id, snapshot]));
    return [...unique.values()].map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as ClientRelatedRecord))
      .sort((left, right) => (Date.parse(isoDate(right.createdAt) ?? '') || 0) - (Date.parse(isoDate(left.createdAt) ?? '') || 0));
  };
  const [requests, quotes, orders, interactionSnapshot, measurementSnapshot] = await Promise.all([
    canRead('quotes:read') ? findRelated('quoteRequests') : Promise.resolve([]),
    canRead('quotes:read') ? findRelated('quotes') : Promise.resolve([]),
    canRead('orders:read') ? findRelated('orders') : Promise.resolve([]),
    collection('clients').doc(clientRef.id).collection('interactions').orderBy('createdAt', 'desc').limit(50).get(),
    canRead('measurements:read') ? collection('measurementProfiles').where('clientId', '==', clientRef.id).limit(50).get() : Promise.resolve(null),
  ]);

  const orderIds = orders.slice(0, 25).map((order) => order.id);
  const payments = canRead('finance:read')
    ? (await Promise.all(orderIds.map((orderId) => collection('orders').doc(orderId).collection('payments').limit(20).get())))
      .flatMap((snapshot, index) => snapshot.docs.map((payment) => {
        const paymentData = payment.data() as Record<string, unknown>;
        return { id: payment.id, orderId: orderIds[index], ...paymentData } as ClientRelatedRecord & { orderId: string };
      }))
    : [];

  const requestSummaries = requests.map((item) => ({
    id: item.id,
    character: typeof item.character === 'string' ? item.character : 'Solicitação',
    franchise: typeof item.franchise === 'string' ? item.franchise : '',
    category: typeof item.category === 'string' ? item.category : '',
    status: typeof item.status === 'string' ? item.status : 'unknown',
    desiredDeliveryDate: typeof item.desiredDeliveryDate === 'string' ? item.desiredDeliveryDate : null,
    createdAt: isoDate(item.createdAt),
  }));
  const quoteSummaries = quotes.map((item) => ({
    id: item.id,
    status: typeof item.status === 'string' ? item.status : 'unknown',
    total: typeof item.total === 'number' ? item.total : null,
    validUntil: typeof item.validUntil === 'string' ? item.validUntil : null,
    createdAt: isoDate(item.createdAt),
  }));
  const orderSummaries = orders.map((item) => ({
    id: item.id,
    status: typeof item.status === 'string' ? item.status : 'unknown',
    character: typeof item.character === 'string' ? item.character : 'Pedido',
    expectedDeliveryDate: typeof item.expectedDeliveryDate === 'string' ? item.expectedDeliveryDate : null,
    ...(canRead('finance:read') ? {
      amountPaid: typeof item.amountPaid === 'number' ? item.amountPaid : 0,
      amountRemaining: typeof item.amountRemaining === 'number' ? item.amountRemaining : 0,
    } : {}),
    createdAt: isoDate(item.createdAt),
  }));
  const paymentSummaries = payments.map((item) => ({
    id: item.id,
    orderId: item.orderId,
    type: typeof item.type === 'string' ? item.type : 'other',
    amount: typeof item.amount === 'number' ? item.amount : 0,
    status: typeof item.status === 'string' ? item.status : 'unknown',
    method: typeof item.method === 'string' ? item.method : null,
    createdAt: isoDate(item.createdAt),
  }));
  const interactionSummaries = interactionSnapshot.docs.map((snapshot) => {
    const item = snapshot.data();
    return {
      id: snapshot.id,
      type: 'note' as const,
      note: typeof item.note === 'string' ? item.note : '',
      createdAt: isoDate(item.createdAt),
    };
  });
  return {
    client: clientView(clientRef.id, client),
    history: {
      requests: requestSummaries,
      quotes: quoteSummaries,
      orders: orderSummaries,
      payments: paymentSummaries,
      measurements: measurementSnapshot?.docs.map((snapshot) => {
        const item = snapshot.data();
        return { id: snapshot.id, name: typeof item.name === 'string' ? item.name : 'Ficha de medidas', active: item.active === true, createdAt: isoDate(item.createdAt), updatedAt: isoDate(item.updatedAt) };
      }) ?? [],
      interactions: interactionSummaries,
      access: {
        quotes: canRead('quotes:read'),
        orders: canRead('orders:read'),
        finance: canRead('finance:read'),
        measurements: canRead('measurements:read'),
      },
    },
  };
});
