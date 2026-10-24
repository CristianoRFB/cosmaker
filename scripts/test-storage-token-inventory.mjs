import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';

assert.equal(process.env.GCLOUD_PROJECT, 'demo-cosmaker', 'Ensaio exclusivo de demo-cosmaker.');
assert.match(process.env.FIREBASE_STORAGE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/, 'Storage deve ser Emulator loopback.');
const execute = promisify(execFile);
const scanner = 'scripts/inventory-emulator-storage-tokens.mjs';
async function scan(env = process.env) {
  const { stdout } = await execute(process.execPath, [scanner], { env, maxBuffer: 1024 * 1024 });
  return { raw: stdout, report: JSON.parse(stdout) };
}
for (const override of [{ GCLOUD_PROJECT: 'not-demo' }, { FIREBASE_STORAGE_EMULATOR_HOST: '192.0.2.1:9199' }]) {
  await assert.rejects(scan({ ...process.env, ...override }), error => error.code === 1
    && error.stdout === '' && /Inventário permitido somente/.test(error.stderr));
}
const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp } = requireFunctions('firebase-admin/app');
const { getStorage } = requireFunctions('firebase-admin/storage');
const app = initializeApp({ projectId: 'demo-cosmaker', storageBucket: 'demo-cosmaker.appspot.com' }, `token-inventory-check-${randomUUID()}`);
const bucket = getStorage(app).bucket();
const path = `ateliers/synthetic-inventory-${randomUUID()}/branding/fixture.png`;
const file = bucket.file(path); const token = randomUUID(); const privateNote = `synthetic-private-${randomUUID()}`;
let created = false;
try {
  const baseline = (await scan()).report.groups.other_legacy || { objects: 0, objectsWithTokenMetadata: 0 };
  const bytes = await readFile(new URL('../tests/fixtures/production-progress.png', import.meta.url));
  assert.equal((await file.exists())[0], false, 'Fixture precisa de namespace novo.');
  await file.save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: {
    contentType: 'image/png', metadata: { firebaseStorageDownloadTokens: token, syntheticPrivateNote: privateNote },
  } });
  created = true;
  const [before] = await file.getMetadata();
  const { raw, report } = await scan();
  assert.deepEqual({ projectId: report.projectId, syntheticOnly: report.syntheticOnly, readOnly: report.readOnly }, { projectId: 'demo-cosmaker', syntheticOnly: true, readOnly: true });
  assert.equal(report.groups.other_legacy.objects, baseline.objects + 1);
  assert.equal(report.groups.other_legacy.objectsWithTokenMetadata, baseline.objectsWithTokenMetadata + 1);
  assert(!raw.includes(path) && !raw.includes(token) && !raw.includes(privateNote), 'Saída deve conter somente contagens sanitizadas.');
  const [after] = await file.getMetadata(); const [preserved] = await file.download();
  assert(after.metadata.firebaseStorageDownloadTokens === token, 'Inventário não deve revogar token.');
  assert.equal(after.generation, before.generation); assert.equal(after.metageneration, before.metageneration);
  assert.deepEqual(preserved, bytes);
  console.log(JSON.stringify({ projectId: 'demo-cosmaker', syntheticOnly: true, readOnlyVerified: true,
    fixtureDelta: { objects: 1, objectsWithTokenMetadata: 1 }, outputContainsPathsTokensOrPrivateMetadata: false,
    guards: { wrongProjectRejected: true, nonLoopbackRejected: true }, realInventory: 'NOT_RUN', globalRevocation: 'NOT_RUN' }, null, 2));
} finally {
  // Remove only the unique synthetic object created by this test, never pre-existing files.
  if (created) await file.delete({ ignoreNotFound: true });
  await app.delete();
}
