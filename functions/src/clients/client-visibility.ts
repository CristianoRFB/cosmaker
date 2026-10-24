import type { DocumentSnapshot, Transaction, QuerySnapshot } from 'firebase-admin/firestore';
import { adminDb } from '../admin';
import { messageId } from '../messages/access';
import { clientEmailIndexId } from './client-data';
const publicStatuses = ['sent', 'approved', 'rejected', 'expired'];
const invalidUid = Symbol('invalid-uid');
function uid(value: unknown) { return value === undefined || value === null ? null : typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/') ? value : invalidUid; }
function email(value: unknown): string | null { return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? value.trim().toLowerCase() : null; }
/** Bulk-load trusted links; an email never overrides an existing UID or a conflicting CRM record. */
export async function visibleClientRecords(tx: Transaction, identity: { uid: string; email: string }, snapshots: DocumentSnapshot[], kind: 'quotes' | 'orders') {
  const candidates = snapshots.filter((snapshot) => { const parts = snapshot.ref.path.split('/'); return snapshot.exists && parts.length === 4 && parts[0] === 'ateliers' && parts[2] === kind && messageId(parts[1]) && (kind !== 'quotes' || publicStatuses.includes(snapshot.get('status'))); });
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
    if (kind === 'orders' && uid(value.clientUserId) !== identity.uid
      && (!messageId(value.clientId) || uid(records.get(`${tenant.path}/clients/${value.clientId}`)?.get('userId')) !== identity.uid)) return false;
    return strong.length ? strong.length === 1 && strong[0] === identity.uid : kind === 'quotes' && address === identity.email;
  });
}
