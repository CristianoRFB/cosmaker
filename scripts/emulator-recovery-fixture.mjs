import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const nonce = process.env.COSMAKER_RECOVERY_RUN; const phase = process.env.COSMAKER_RECOVERY_PHASE;
assert.match(nonce || '', /^[a-f0-9]{8}$/); assert.ok(['write', 'verify'].includes(phase));
for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) assert.match(process.env[key] || '', /^127\.0\.0\.1:\d{1,5}$/);
const requireFromFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp } = requireFromFunctions('firebase-admin/app'); const { getFirestore, Timestamp } = requireFromFunctions('firebase-admin/firestore');
const { getAuth } = requireFromFunctions('firebase-admin/auth'); const { getStorage } = requireFromFunctions('firebase-admin/storage');
const app = initializeApp({ projectId: 'demo-cosmaker', storageBucket: 'demo-cosmaker.appspot.com' }, `recovery-${nonce}`);
const db = getFirestore(app); const auth = getAuth(app); const bucket = getStorage(app).bucket();
const uid = `recovery-client-${nonce}`; const email = `${uid}@cosmaker.test`; const password = 'SyntheticRecovery!2026';
const a = `recovery-a-${nonce}`; const b = `recovery-b-${nonce}`;
const path = `ateliers/${a}/orders/order-a/files/synthetic.bin`; const bytes = Buffer.from([0, 1, 2, 127, 128, 254, 255]);
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
async function maintenance(script, args, env) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: 'inherit', env: { ...process.env, FIREBASE_ADMIN_PROJECT_ID: 'demo-cosmaker', ...env } });
    child.once('error', reject); child.once('exit', code => code === 0 ? resolveRun() : reject(new Error('Manutenção sintética recusada.')));
  });
}
try {
  if (phase === 'write') {
    const user = await auth.createUser({ uid, email, password, emailVerified: true }); await auth.setCustomUserClaims(user.uid, { syntheticRecovery: true });
    const batch = db.batch();
    batch.set(db.doc(`users/${uid}`), { active: true, accountType: 'client', email });
    for (const tenant of [a, b]) batch.set(db.doc(`ateliers/${tenant}`), { active: true, syntheticRecovery: nonce });
    batch.set(db.doc(`ateliers/${a}/orders/order-a`), { status: 'completed', clientUserId: uid, email, amountPaidCents: 100000, amountRemainingCents: 0, createdAt: Timestamp.fromMillis(1792670400000) });
    batch.set(db.doc(`ateliers/${b}/orders/order-b`), { status: 'completed', clientUserId: `other-${nonce}`, amountPaidCents: 99999 });
    batch.set(db.doc(`ateliers/${a}/financeEntries/entry-a`), { amountCents: 12345, kind: 'expense', basis: 'actual', effectiveDate: '2026-10-22' });
    batch.set(db.doc(`ateliers/${a}/orders/order-a/statusHistory/delivery`), { status: 'completed', source: 'manual_complete', note: 'Conferência sintética', createdAt: Timestamp.fromMillis(1792670400000) });
    await batch.commit(); await bucket.file(path).save(bytes, { metadata: { contentType: 'application/octet-stream', metadata: { syntheticRecovery: nonce, sha256: hash(bytes) } } });
    const operator = await auth.createUser({ uid: `recovery-operator-${nonce}`, email: `recovery-operator-${nonce}@cosmaker.test`, password, emailVerified: true });
    await maintenance('scripts/provision-platform-admin.mjs', ['--apply'], { COSMAKER_ADMIN_EMAIL: operator.email });
    assert.equal((await auth.getUser(operator.uid)).customClaims.platformAdmin, true);
    await db.doc(`publicAteliers/${a}`).set({ published: false });
    await maintenance('scripts/migrate-public-tenant-slug.mjs', ['--apply', `--atelier-id=${a}`, `--slug=recovery-${nonce}`], {});
    assert.equal((await db.doc(`publicAtelierSlugs/recovery-${nonce}`).get()).get('atelierId'), a);
    const expected = resolve('.firebase', `recovery-${nonce}`); assert.equal(process.env.COSMAKER_RECOVERY_EXPORT, resolve(expected, 'export')); assert.equal(process.env.COSMAKER_RECOVERY_CONFIG, resolve(expected, 'firebase.json'));
    await new Promise((resolveExport, reject) => {
      const child = spawn(process.execPath, ['scripts/firebase-local-cli.mjs', 'emulators:export', process.env.COSMAKER_RECOVERY_EXPORT, '--project', 'demo-cosmaker', '--config', process.env.COSMAKER_RECOVERY_CONFIG], { stdio: 'inherit', env: process.env });
      child.once('error', reject); child.once('exit', (code) => code === 0 ? resolveExport() : reject(new Error(`Export falhou (${code}).`)));
    });
    console.log('RECOVERY WRITE PASS: apenas fixture sintética exportada.');
  } else {
    const user = await auth.getUser(uid); assert.equal(user.emailVerified, true); assert.equal(user.customClaims.syntheticRecovery, true);
    const manifest = JSON.parse(await readFile(resolve('.firebase', `recovery-${nonce}`, 'snapshot-manifest.json'), 'utf8'));
    const users = await auth.listUsers(1000); assert.equal(users.pageToken, undefined);
    assert.equal(users.users.length, manifest.authUidCount);
    assert.equal(hash(JSON.stringify(users.users.map(user => user.uid).sort())), manifest.authUidInventorySha256);
    const operator = await auth.getUser(`recovery-operator-${nonce}`); assert.equal(operator.customClaims.platformAdmin, true);
    assert.equal((await db.doc(`users/${operator.uid}`).get()).get('accountType'), 'platform_admin');
    assert.equal((await db.doc(`publicAteliers/${a}`).get()).get('published'), false);
    assert.equal((await db.doc(`publicAtelierSlugs/recovery-${nonce}`).get()).get('atelierId'), a);
    const order = (await db.doc(`ateliers/${a}/orders/order-a`).get()).data(); assert.equal(order.amountPaidCents, 100000); assert.equal(order.createdAt.toMillis(), 1792670400000);
    assert.equal((await db.doc(`ateliers/${a}/financeEntries/entry-a`).get()).data().amountCents, 12345);
    assert.equal((await db.doc(`ateliers/${b}/orders/order-b`).get()).data().amountPaidCents, 99999);
    assert.equal((await db.doc(`ateliers/${a}/orders/order-a/statusHistory/delivery`).get()).data().note, 'Conferência sintética');
    const [restored] = await bucket.file(path).download(); assert.deepEqual(restored, bytes); const [metadata] = await bucket.file(path).getMetadata(); assert.equal(metadata.metadata.sha256, hash(bytes));
    const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
    assert.equal(response.status, 200); const token = (await response.json()).idToken;
    for (const [document, expectedStatus] of [[`ateliers/${a}/orders/order-a/statusHistory/delivery`, 200], [`ateliers/${a}/orders/order-a`, 403], [`ateliers/${b}/orders/order-b`, 403], [`ateliers/${a}/financeEntries/entry-a`, 403]]) {
      const result = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-cosmaker/databases/(default)/documents/${document}`, { headers: { Authorization: `Bearer ${token}` } }); assert.equal(result.status, expectedStatus, `ACL restaurada: ${document}`);
    }
    const privateObject = await fetch(`http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/demo-cosmaker.appspot.com/o/${encodeURIComponent(path)}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(privateObject.status, 403, 'Storage raw restaurado continua privado para o cliente.');
    console.log('RECOVERY VERIFY PASS: Auth/senha/claims, centavos/timestamp/histórico A/B, bytes/SHA-256 e Rules após restore.');
  }
} finally { await app.delete(); }
