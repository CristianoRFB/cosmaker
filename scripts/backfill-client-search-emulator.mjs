import { createRequire } from 'node:module';

const requireFromFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp } = requireFromFunctions('firebase-admin/app');
const { FieldPath, getFirestore, Timestamp } = requireFromFunctions('firebase-admin/firestore');

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null;
}

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || argument('emulator-host');
if (!emulatorHost || !/^(localhost|127\.0\.0\.1|\[::1\]):\d{1,5}$/.test(emulatorHost)) {
  throw new Error('Backfill recusado: informe um host local em --emulator-host=127.0.0.1:18080 ou FIRESTORE_EMULATOR_HOST.');
}
process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
const projectId = 'demo-cosmaker';
const apply = process.argv.includes('--apply');
if (apply && argument('confirm-project') !== projectId) {
  throw new Error('Gravação recusada. Confirme o projeto isolado com --confirm-project=demo-cosmaker.');
}

let normalizeClientSearch;
let buildClientSearchPrefixes;
let clientEmailIndexId;
try {
  ({ normalizeClientSearch, buildClientSearchPrefixes, clientEmailIndexId } = requireFromFunctions('./lib/clients/client-data.js'));
} catch {
  throw new Error('Execute npm run functions:build antes do backfill local.');
}

const app = initializeApp({ projectId }, `client-search-backfill-${Date.now()}`);
const db = getFirestore(app);
const atelierSnapshots = await db.collection('ateliers').get();
const candidates = [];
let scanned = 0;
let invalid = 0;

for (const atelier of atelierSnapshots.docs) {
  let page = await db.collection(`ateliers/${atelier.id}/clients`).orderBy(FieldPath.documentId()).limit(250).get();
  while (!page.empty) {
    for (const snapshot of page.docs) {
      scanned += 1;
      const data = snapshot.data();
      const name = typeof data.name === 'string' ? data.name.trim().replace(/\s+/g, ' ') : '';
      const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
      if (name.length < 2 || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        invalid += 1;
        continue;
      }
      candidates.push({ ref: snapshot.ref, name, email, atelierId: atelier.id });
    }
    if (page.size < 250) break;
    page = await db.collection(`ateliers/${atelier.id}/clients`).orderBy(FieldPath.documentId()).startAfter(page.docs.at(-1)).limit(250).get();
  }
}

const emailGroups = new Map();
for (const candidate of candidates) {
  const key = `${candidate.atelierId}:${candidate.email}`;
  emailGroups.set(key, [...(emailGroups.get(key) ?? []), candidate]);
}
const duplicates = new Set([...emailGroups.values()].filter((group) => group.length > 1).flatMap((group) => group.map((item) => item.ref.path)));
let eligible = 0;
let alreadyCurrent = 0;
let conflicts = 0;
let migrated = 0;

function hasSearchFields(data, expected) {
  return data.nameSearch === expected.nameSearch
    && data.emailSearch === expected.emailSearch
    && Array.isArray(data.searchPrefixes)
    && data.searchPrefixes.length === expected.searchPrefixes.length
    && expected.searchPrefixes.every((prefix) => data.searchPrefixes.includes(prefix));
}

for (const candidate of candidates) {
  if (duplicates.has(candidate.ref.path)) {
    conflicts += 1;
    continue;
  }
  const searchFields = {
    nameSearch: normalizeClientSearch(candidate.name),
    emailSearch: normalizeClientSearch(candidate.email),
    searchPrefixes: buildClientSearchPrefixes(candidate.name, candidate.email),
  };
  const emailIndexRef = db.doc(`ateliers/${candidate.atelierId}/clientEmailIndex/${clientEmailIndexId(candidate.email)}`);

  if (!apply) {
    const [clientSnapshot, indexSnapshot] = await Promise.all([candidate.ref.get(), emailIndexRef.get()]);
    if (indexSnapshot.exists && indexSnapshot.data()?.clientId !== candidate.ref.id) {
      conflicts += 1;
      continue;
    }
    const clientData = clientSnapshot.data() ?? {};
    const matches = hasSearchFields(clientData, searchFields);
    const indexed = indexSnapshot.exists && indexSnapshot.data()?.clientId === candidate.ref.id;
    if (matches && indexed) alreadyCurrent += 1;
    else eligible += 1;
    continue;
  }

  try {
    const result = await db.runTransaction(async (transaction) => {
      const [clientSnapshot, indexSnapshot] = await Promise.all([transaction.get(candidate.ref), transaction.get(emailIndexRef)]);
      if (!clientSnapshot.exists) return 'missing';
      if (indexSnapshot.exists && indexSnapshot.data()?.clientId !== candidate.ref.id) return 'conflict';
      if (hasSearchFields(clientSnapshot.data() ?? {}, searchFields)
        && indexSnapshot.exists && indexSnapshot.data()?.clientId === candidate.ref.id) return 'already-current';
      const now = Timestamp.now();
      transaction.set(candidate.ref, searchFields, { merge: true });
      transaction.set(emailIndexRef, { clientId: candidate.ref.id, updatedAt: now });
      return 'migrated';
    });
    if (result === 'migrated') migrated += 1;
    else if (result === 'already-current') alreadyCurrent += 1;
    else conflicts += 1;
  } catch {
    conflicts += 1;
  }
}

console.log(JSON.stringify({
  mode: apply ? 'emulator-apply' : 'emulator-dry-run',
  project: projectId,
  scanned,
  eligible,
  alreadyCurrent,
  migrated,
  invalid,
  conflicts,
}, null, 2));
await app.delete();
