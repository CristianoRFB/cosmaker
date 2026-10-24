import { createHash } from 'node:crypto';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { identity } from './order-file-bytes';
import { messageId, messageInput } from '../messages/access';

async function clientSession(call: CallableRequest) {
  const token = await identity(call.rawRequest);
  if (token.uid !== call.auth?.uid) throw new HttpsError('unauthenticated', 'Entre novamente para consultar medidas.');
  return token.uid;
}
async function profileActor(tx: Transaction, uid: string) {
  const profile = await tx.get(adminDb.doc(`users/${uid}`));
  if (profile.get('active') !== true || profile.get('accountType') !== 'client') throw new HttpsError('permission-denied', 'Sua conta não tem um perfil de cliente ativo.');
}
const canonicalClient = (path: string) => { const parts = path.split('/'); return parts.length === 4 && parts[0] === 'ateliers' && parts[2] === 'clients' && messageId(parts[1]) && messageId(parts[3]); };
const millis = (value: unknown) => value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function' ? Number(value.toMillis()) : 0;
const iso = (value: unknown) => { const time = millis(value); return Number.isFinite(time) && time > 0 ? new Date(time).toISOString() : null; };

export const listClientMeasurementProfiles = onCall(async (call) => {
  const uid = await clientSession(call);
  messageInput(call.data ?? {}, []);
  return adminDb.runTransaction(async tx => {
    await profileActor(tx, uid);
    const linked = await tx.get(adminDb.collectionGroup('clients').where('userId', '==', uid).limit(101));
    if (linked.size > 100) throw new HttpsError('resource-exhausted', 'Os vínculos precisam de uma consulta assistida pelo ateliê.');
    const clients = linked.docs.filter(client => canonicalClient(client.ref.path));
    const results = await Promise.all([
      tx.get(adminDb.collectionGroup('measurementProfiles').where('clientId', '==', uid).limit(501)),
      ...clients.map(client => tx.get(client.ref.parent.parent!.collection('measurementProfiles').where('clientId', '==', client.id).limit(501))),
    ]);
    if (results.some(result => result.size > 500)) throw new HttpsError('resource-exhausted', 'As fichas precisam de uma consulta assistida pelo ateliê.');
    const candidates = [...new Map(results.flatMap(result => result.docs).map(record => [record.ref.path, record])).values()].filter(record => {
      const parts = record.ref.path.split('/'); return parts.length === 4 && parts[0] === 'ateliers' && parts[2] === 'measurementProfiles' && messageId(parts[1]) && messageId(record.get('clientId'));
    });
    if (candidates.length > 1000) throw new HttpsError('resource-exhausted', 'As fichas precisam de uma consulta assistida pelo ateliê.');
    const paths = [...new Set(candidates.flatMap(record => [record.ref.parent.parent!.path, `${record.ref.parent.parent!.path}/clients/${record.get('clientId')}`]))];
    const records = new Map((paths.length ? await tx.getAll(...paths.map(path => adminDb.doc(path))) : []).map(record => [record.ref.path, record]));
    const profiles = candidates.filter(record => records.get(record.ref.parent.parent!.path)?.get('active') === true
      && records.get(`${record.ref.parent.parent!.path}/clients/${record.get('clientId')}`)?.get('userId') === uid
      && (record.get('atelierId') === undefined || record.get('atelierId') === record.ref.parent.parent!.id))
      .sort((a, b) => millis(b.get('updatedAt')) - millis(a.get('updatedAt')) || a.ref.path.localeCompare(b.ref.path))
      .map(record => ({ id: record.id, atelierId: record.ref.parent.parent!.id, clientId: record.get('clientId'), name: typeof record.get('name') === 'string' ? record.get('name') : 'Ficha de medidas', active: record.get('active') === true, createdAt: iso(record.get('createdAt')), updatedAt: iso(record.get('updatedAt')) }));
    return { profiles };
  });
});

export const createClientMeasurementProfile = onCall(async call => {
  const uid = await clientSession(call);
  const data = messageInput(call.data, ['atelierId', 'name', 'requestId']);
  if (!messageId(data.atelierId) || !messageId(data.requestId) || typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 100) throw new HttpsError('invalid-argument', 'Ateliê ou nome da ficha inválido.');
  const name = data.name.trim(); const atelierId = data.atelierId;
  const id = `profile-${createHash('sha256').update(JSON.stringify([uid, atelierId, data.requestId])).digest('hex').slice(0, 40)}`;
  const root = adminDb.doc(`ateliers/${atelierId}`); const target = root.collection('measurementProfiles').doc(id);
  return adminDb.runTransaction(async tx => {
    await profileActor(tx, uid);
    const [atelier, links, existing] = await Promise.all([tx.get(root), tx.get(root.collection('clients').where('userId', '==', uid).limit(2)), tx.get(target)]);
    if (atelier.get('active') !== true || links.size !== 1) throw new HttpsError('permission-denied', 'Abra a ficha por um pedido vinculado ou solicite ao ateliê a revisão do seu cadastro.');
    const clientId = links.docs[0].id;
    if (existing.exists) {
      if (existing.get('clientId') !== clientId || existing.get('name') !== name) throw new HttpsError('already-exists', 'Esta solicitação já criou outra ficha.');
      return { profileId: id, alreadyCreated: true };
    }
    const now = FieldValue.serverTimestamp();
    tx.create(target, { clientId, name, active: true, createdAt: now, updatedAt: now });
    tx.create(adminDb.collection('auditLogs').doc(), { atelierId, actorId: uid, action: 'measurement.profile_created', entity: 'measurementProfile', entityId: id, timestamp: now });
    return { profileId: id, alreadyCreated: false };
  });
});
