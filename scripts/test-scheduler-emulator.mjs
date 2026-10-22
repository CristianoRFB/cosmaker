import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
for (const name of ['FIRESTORE_EMULATOR_HOST', 'PUBSUB_EMULATOR_HOST']) assert.match(process.env[name] || '', /^127\.0\.0\.1:\d{1,5}$/);
const requireFromFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp } = requireFromFunctions('firebase-admin/app'); const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
const app = initializeApp({ projectId: 'demo-cosmaker' }, 'scheduler-check'); const db = getFirestore(app);
const nonce = randomBytes(4).toString('hex'); const a = `scheduler-a-${nonce}`; const b = `scheduler-b-${nonce}`;
const today = new Date().toISOString().slice(0, 10); const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10); const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const foreignRoot = db.doc(`schedulerForeign/${nonce}`); const foreign = foreignRoot.collection('quotes').doc('foreign');
const mode = process.argv.includes('--http') ? 'http' : 'pubsub';
async function publish() {
  if (mode === 'http') {
    const response = await fetch('http://127.0.0.1:15001/demo-cosmaker/us-central1/expireQuotes-0', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CloudScheduler-JobName': 'projects/demo-cosmaker/locations/us-central1/jobs/emulator-expiry', 'X-CloudScheduler-ScheduleTime': new Date().toISOString() }, body: '{}' });
    assert.equal(response.status, 200, await response.text()); return;
  }
  const result = await fetch(`http://${process.env.PUBSUB_EMULATOR_HOST}/v1/projects/demo-cosmaker/topics/firebase-schedule-expireQuotes:publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ data: Buffer.from('{}').toString('base64') }] }) });
  assert.equal(result.status, 200); assert.ok((await result.json()).messageIds?.length);
}
async function waitFor(predicate, label) { const end = Date.now() + 25000; while (Date.now() < end) { if (await predicate()) return; await new Promise((resolve) => setTimeout(resolve, 250)); } throw new Error(`Timeout do scheduler local: ${label}.`); }
try {
  const batch = db.batch();
  for (const tenant of [a, b]) {
    batch.set(db.doc(`ateliers/${tenant}`), { active: true });
    for (const [id, validUntil] of [['expired', yesterday], ['today', today], ['future', tomorrow], ['invalid', '2000-02-30']]) {
      batch.set(db.doc(`ateliers/${tenant}/quotes/${id}`), { requestId: id, status: 'sent', validUntil, total: 100 });
      batch.set(db.doc(`ateliers/${tenant}/quoteRequests/${id}`), { status: 'quoted', activeQuoteId: id });
    }
  }
  batch.set(db.doc(`ateliers/${a}/quotes/old`), { requestId: 'replacement', status: 'sent', validUntil: yesterday, total: 100 });
  batch.set(db.doc(`ateliers/${a}/quoteRequests/replacement`), { status: 'quoted', activeQuoteId: 'newer' });
  batch.set(foreign, { requestId: 'foreign', status: 'sent', validUntil: yesterday, total: 100 });
  await batch.commit(); await publish();
  await waitFor(async () => (await db.doc(`ateliers/${a}/quotes/expired`).get()).get('status') === 'expired' && (await db.doc(`ateliers/${b}/quotes/expired`).get()).get('status') === 'expired', 'evento Pub/Sub e expiração A/B');
  await new Promise((resolve) => setTimeout(resolve, 1500));
  for (const tenant of [a, b]) {
    for (const id of ['today', 'future', 'invalid']) assert.equal((await db.doc(`ateliers/${tenant}/quotes/${id}`).get()).get('status'), 'sent', `${tenant}/${id}`);
    assert.equal((await db.doc(`ateliers/${tenant}/quoteRequests/expired`).get()).get('status'), 'expired');
  }
  assert.equal((await foreign.get()).get('status'), 'sent', 'namespace externo não pode ser alterado');
  assert.equal((await db.doc(`ateliers/${a}/quoteRequests/replacement`).get()).get('activeQuoteId'), 'newer');
  const logs = async () => {
    const list = await db.collection('auditLogs').where('action', '==', 'quote.expired').get(); return list.docs.filter((doc) => [a, b, nonce].includes(doc.get('atelierId')));
  };
  assert.equal((await logs()).length, 3);
  await publish(); await new Promise((resolve) => setTimeout(resolve, 1500)); assert.equal((await logs()).length, 3, 'redelivery não duplica auditoria');
  console.log(`SCHEDULER ${mode.toUpperCase()} PASS: invocação local real, expiração A/B após dia UTC, hoje/futuro/data inválida/namespace externo preservados, versão ativa e auditoria idempotentes.`);
} finally {
  for (const tenant of [a, b]) await db.recursiveDelete(db.doc(`ateliers/${tenant}`)); await db.recursiveDelete(foreignRoot);
  const logs = await db.collection('auditLogs').where('action', '==', 'quote.expired').get(); await Promise.all(logs.docs.filter((doc) => [a, b, nonce].includes(doc.get('atelierId'))).map((doc) => doc.ref.delete())); await app.delete();
}
