import { HttpsError, onCall } from 'firebase-functions/v2/https';
import type { DocumentSnapshot, Transaction, QuerySnapshot } from 'firebase-admin/firestore';
import { adminDb } from '../admin';
import { requireVerifiedIdentity } from '../orders/access';
import { messageInput, messageId } from '../messages/access';
import { clientEmailIndexId } from '../clients/client-data';
import { moneyToCents } from '../orders/change-policy';
import { parseScheduleDate } from '../scheduling/allocate-capacity';
const publicStatuses = ['sent', 'approved', 'rejected', 'expired'];
const invalidUid = Symbol('invalid-uid');
function uid(value: unknown) { return value === undefined || value === null ? null : typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/') ? value : invalidUid; }
function time(value: unknown): number | null { if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') { const result = value.toMillis(); return typeof result === 'number' && Number.isFinite(result) ? result : null; } return null; }
const iso = (value: unknown) => { const millis = time(value); return millis === null ? null : new Date(millis).toISOString(); };
async function actor(tx: Transaction, auth: { uid: string; token: Record<string, unknown> }) {
  requireVerifiedIdentity(auth);
  const profile = await tx.get(adminDb.doc(`users/${auth.uid}`));
  if (profile.get('active') !== true || profile.get('accountType') !== 'client' || typeof auth.token.email !== 'string') throw new HttpsError('permission-denied', 'Seu perfil não pode consultar propostas de cliente.');
  return { uid: auth.uid, email: auth.token.email.trim().toLowerCase() };
}
function email(value: unknown): string | null { return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? value.trim().toLowerCase() : null; }
/** Bulk-load trusted links; an email never overrides an existing UID or a conflicting CRM record. */
export async function visibleClientQuotes(tx: Transaction, identity: { uid: string; email: string }, snapshots: DocumentSnapshot[]) {
  const candidates = snapshots.filter((snapshot) => { const parts = snapshot.ref.path.split('/'); return snapshot.exists && parts.length === 4 && parts[0] === 'ateliers' && parts[2] === 'quotes' && messageId(parts[1]) && publicStatuses.includes(snapshot.get('status')); });
  const paths = new Set<string>();
  const emailQueries = new Map<string, Promise<QuerySnapshot>>();
  for (const snapshot of candidates) {
    const address = email(snapshot.get('email')); const tenant = snapshot.ref.parent.parent!;
    if (address) { const key = `${tenant.path}/${address}`; if (!emailQueries.has(key)) emailQueries.set(key, tx.get(tenant.collection('clients').where('email', '==', address).limit(2))); }
  }
  const emailClients = new Map(await Promise.all([...emailQueries].map(async ([key, result]) => [key, await result] as const)));
  for (const snapshot of candidates) {
    const tenant = snapshot.ref.parent.parent!; paths.add(tenant.path);
    const value = snapshot.data()!; const address = email(value.email); if (address) paths.add(`${tenant.path}/clientEmailIndex/${clientEmailIndexId(address)}`);
    if (messageId(value.clientId)) paths.add(`${tenant.path}/clients/${value.clientId}`);
  }
  const records = new Map((paths.size ? await tx.getAll(...[...paths].map((path) => adminDb.doc(path))) : []).map((record) => [record.ref.path, record]));
  for (const result of emailClients.values()) for (const record of result.docs) records.set(record.ref.path, record);
  const missing = new Set<string>();
  for (const record of records.values()) if (record.ref.parent.id === 'clientEmailIndex' && messageId(record.get('clientId'))) {
    const path = `${record.ref.parent.parent!.path}/clients/${record.get('clientId')}`; if (!records.has(path)) missing.add(path);
  }
  if (missing.size) for (const record of await tx.getAll(...[...missing].map((path) => adminDb.doc(path)))) records.set(record.ref.path, record);
  return candidates.filter((snapshot) => {
    const tenant = snapshot.ref.parent.parent!; const value = snapshot.data()!; const address = email(value.email);
    if (records.get(tenant.path)?.get('active') !== true || !address || (value.atelierId !== undefined && value.atelierId !== tenant.id)) return false;
    if (value.clientId !== undefined && value.clientId !== null && !messageId(value.clientId)) return false;
    const index = records.get(`${tenant.path}/clientEmailIndex/${clientEmailIndexId(address)}`);
    if (index?.exists && !messageId(index.get('clientId'))) return false;
    const matching = emailClients.get(`${tenant.path}/${address}`);
    const ids = [...new Set([messageId(value.clientId) ? value.clientId : null, index?.exists ? index.get('clientId') : null, ...(matching?.docs.map((client) => client.id) ?? [])].filter(Boolean))];
    if (ids.length > 1) return false;
    const links = ids.map((id) => records.get(`${tenant.path}/clients/${id}`)); if (links.some((link) => !link?.exists)) return false;
    const uids = [uid(value.clientUserId), uid(value.approvedBy), uid(value.rejectedBy), ...links.map((link) => uid(link!.get('userId')))];
    if (uids.includes(invalidUid)) return false;
    const strong = [...new Set(uids.filter((value): value is string => typeof value === 'string'))];
    return strong.length ? strong.length === 1 && strong[0] === identity.uid : address === identity.email;
  });
}
function quoteView(snapshot: DocumentSnapshot) {
  const value = snapshot.data()!;
  const amounts = ['materialsCost', 'laborCost', 'otherCost', 'urgencyFee', 'shipping', 'discount', 'subtotal', 'total', 'depositAmount'];
  try { amounts.forEach((key) => moneyToCents(value[key])); } catch { throw new HttpsError('failed-precondition', 'Os valores de uma proposta precisam de conferência pelo ateliê.'); }
  if (!parseScheduleDate(value.validUntil) || typeof value.depositPercentage !== 'number' || !Number.isFinite(value.depositPercentage) || value.depositPercentage < 0 || value.depositPercentage > 100 || !messageId(value.requestId)) throw new HttpsError('failed-precondition', 'Uma proposta precisa de conferência pelo ateliê.');
  if (['expectedStartDate', 'expectedCompletionDate'].some((key) => value[key] !== undefined && value[key] !== null && !parseScheduleDate(value[key]))) throw new HttpsError('failed-precondition', 'As datas da proposta precisam de conferência pelo ateliê.');
  const fields = [...amounts, 'requestId', 'clientId', 'email', 'status', 'depositPercentage', 'validUntil', 'expectedStartDate', 'expectedCompletionDate'];
  return { ...Object.fromEntries(fields.filter((key) => value[key] !== undefined).map((key) => [key, value[key]])), id: snapshot.id, atelierId: snapshot.ref.parent.parent!.id, createdAt: iso(value.createdAt), updatedAt: iso(value.updatedAt) };
}
function cursorPath(value: unknown) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length > 1500) throw new HttpsError('invalid-argument', 'Página de propostas inválida.');
  let path = ''; try { path = Buffer.from(value, 'base64url').toString('utf8'); } catch { /* Rejected below. */ }
  const parts = path.split('/'); if (parts.length !== 4 || parts[0] !== 'ateliers' || parts[2] !== 'quotes' || !messageId(parts[1]) || !messageId(parts[3])) throw new HttpsError('invalid-argument', 'Página de propostas inválida.');
  return path;
}
export const listClientQuotes = onCall(async (call) => {
  requireVerifiedIdentity(call.auth); const data = messageInput(call.data, ['cursor']); const cursor = cursorPath(data.cursor);
  return adminDb.runTransaction(async (tx) => {
    const identity = await actor(tx, call.auth!);
    const [byEmail, byUid, byApproval, byRejection, clients] = await Promise.all([
      tx.get(adminDb.collectionGroup('quotes').where('email', '==', identity.email).where('status', 'in', publicStatuses).limit(501)),
      tx.get(adminDb.collectionGroup('quotes').where('clientUserId', '==', identity.uid).where('status', 'in', publicStatuses).limit(501)),
      tx.get(adminDb.collectionGroup('quotes').where('approvedBy', '==', identity.uid).where('status', 'in', publicStatuses).limit(501)),
      tx.get(adminDb.collectionGroup('quotes').where('rejectedBy', '==', identity.uid).where('status', 'in', publicStatuses).limit(501)),
      tx.get(adminDb.collectionGroup('clients').where('userId', '==', identity.uid).limit(101)),
    ]);
    if (clients.size > 100) throw new HttpsError('resource-exhausted', 'Seu histórico exige uma consulta paginada por ateliê antes de listar todas as propostas.');
    const ownClients = clients.docs.filter((snapshot) => { const parts = snapshot.ref.path.split('/'); return parts.length === 4 && parts[0] === 'ateliers' && parts[2] === 'clients' && messageId(parts[1]); });
    const linked = await Promise.all(ownClients.map((client) => tx.get(client.ref.parent.parent!.collection('quotes').where('clientId', '==', client.id).where('status', 'in', publicStatuses).limit(501))));
    const queries = [byEmail, byUid, byApproval, byRejection, ...linked];
    if (queries.some((query) => query.size > 500)) throw new HttpsError('resource-exhausted', 'Seu histórico exige uma consulta paginada por ateliê antes de listar todas as propostas.');
    const candidates = [...new Map(queries.flatMap((query) => query.docs).map((snapshot) => [snapshot.ref.path, snapshot])).values()];
    if (candidates.length > 1000) throw new HttpsError('resource-exhausted', 'Seu histórico exige uma consulta paginada por ateliê antes de listar todas as propostas.');
    const visible = (await visibleClientQuotes(tx, identity, candidates)).sort((a, b) => (time(b.get('createdAt')) ?? 0) - (time(a.get('createdAt')) ?? 0) || a.ref.path.localeCompare(b.ref.path));
    const last = cursor ? visible.findIndex((snapshot) => snapshot.ref.path === cursor) : -1;
    if (cursor && last < 0) throw new HttpsError('permission-denied', 'Esta página não está disponível para sua conta.');
    const page = visible.slice(last + 1, last + 51);
    return { quotes: page.map(quoteView), nextCursor: visible.length > last + 51 && page.length ? Buffer.from(page.at(-1)!.ref.path).toString('base64url') : null };
  }, { readOnly: true });
});
export const getClientQuote = onCall(async (call) => {
  requireVerifiedIdentity(call.auth); const data = messageInput(call.data, ['atelierId', 'quoteId', 'responseCursor']);
  if (![data.atelierId, data.quoteId].every(messageId) || (data.responseCursor !== undefined && !messageId(data.responseCursor))) throw new HttpsError('invalid-argument', 'Identificação da proposta inválida.');
  const ref = adminDb.doc(`ateliers/${data.atelierId}/quotes/${data.quoteId}`);
  return adminDb.runTransaction(async (tx) => {
    const identity = await actor(tx, call.auth!); const snapshot = await tx.get(ref);
    if (!(await visibleClientQuotes(tx, identity, [snapshot])).length) throw new HttpsError('permission-denied', 'Esta proposta não está disponível para sua conta.');
    const [items, responses] = await Promise.all([tx.get(ref.collection('items').limit(101)), tx.get(ref.collection('responses').limit(501))]);
    if (items.size > 100 || responses.size > 500) throw new HttpsError('resource-exhausted', 'O histórico desta proposta precisa de uma consulta paginada adicional.');
    const ordered = [...responses.docs].sort((a, b) => (time(b.get('createdAt')) ?? 0) - (time(a.get('createdAt')) ?? 0) || a.id.localeCompare(b.id));
    const last = data.responseCursor ? ordered.findIndex((row) => row.id === data.responseCursor) : -1;
    if (data.responseCursor && last < 0) throw new HttpsError('invalid-argument', 'A página de respostas mudou. Atualize a proposta.');
    const page = ordered.slice(last + 1, last + 51);
    return { quote: quoteView(snapshot), items: [...items.docs].sort((a, b) => (time(a.get('createdAt')) ?? 0) - (time(b.get('createdAt')) ?? 0) || a.id.localeCompare(b.id)).map((row) => {
      const value = row.data(); if (typeof value.description !== 'string' || value.description.length > 160 || !['material', 'labor', 'other'].includes(value.category) || typeof value.quantity !== 'number' || !Number.isFinite(value.quantity) || value.quantity <= 0) throw new HttpsError('failed-precondition', 'Um item da proposta precisa de conferência.');
      try { moneyToCents(value.unitPrice); moneyToCents(value.total); } catch { throw new HttpsError('failed-precondition', 'Um item da proposta tem valores inconsistentes.'); }
      return { id: row.id, description: value.description, category: value.category, quantity: value.quantity, unitPrice: value.unitPrice, total: value.total };
    }), responses: page.map((row) => {
      const value = row.data(); if (!['approved', 'rejected', 'request_changes'].includes(value.decision) || typeof value.comment !== 'string' || value.comment.length > 1000) throw new HttpsError('failed-precondition', 'Uma resposta da proposta precisa de conferência.');
      return { id: row.id, decision: value.decision, comment: value.comment, createdAt: iso(value.createdAt) };
    }), nextResponsesCursor: ordered.length > last + 51 && page.length ? page.at(-1)!.id : null };
  }, { readOnly: true });
});
