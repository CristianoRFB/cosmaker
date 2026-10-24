import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, rm, readFile, symlink } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { inspectSyntheticSnapshot, sealSyntheticSnapshot, verifySyntheticSnapshot } from '../../scripts/operations/synthetic-snapshot.mjs';

async function fixture(run) {
  const directory = resolve('.firebase', `recovery-${randomBytes(4).toString('hex')}`, 'export');
  try {
    for (const part of ['auth_export', 'firestore_export', 'storage_export']) { await mkdir(join(directory, part), { recursive: true }); await writeFile(join(directory, part, 'synthetic.bin'), Buffer.from([0, 127, 255])); }
    await writeFile(join(directory, 'auth_export/accounts.json'), '{"users":[{"localId":"synthetic-uid"}]}');
    await writeFile(join(directory, 'firebase-export-metadata.json'), JSON.stringify(Object.fromEntries(['auth', 'firestore', 'storage'].map(service => [service, { path: `${service}_export` }]))));
    await run(directory);
  } finally { await rm(dirname(directory), { recursive: true, force: true }); }
}
test('snapshot seals complete synthetic exports without overwriting; default inspection is read-only', async () => fixture(async directory => {
  assert.equal((await inspectSyntheticSnapshot(directory)).files, 5);
  await assert.rejects(readFile(join(dirname(directory), 'snapshot-manifest.json')));
  await sealSyntheticSnapshot(directory); await verifySyntheticSnapshot(directory);
  await assert.rejects(sealSyntheticSnapshot(directory));
}));
test('snapshot rejects corruption, missing files and unexpected files before any import', async () => {
  for (const mutate of [
    directory => writeFile(join(directory, 'auth_export/synthetic.bin'), 'corrupt'),
    directory => rm(join(directory, 'storage_export/synthetic.bin')),
    directory => writeFile(join(directory, 'unexpected.bin'), 'extra'),
    directory => writeFile(join(directory, 'auth_export/accounts.json'), '{"users":[{"localId":"duplicate"},{"localId":"duplicate"}]}'),
  ]) await fixture(async directory => { await sealSyntheticSnapshot(directory); await mutate(directory); await assert.rejects(verifySyntheticSnapshot(directory)); });
});
test('snapshot refuses arbitrary destinations, symlinks and incomplete exports', async () => {
  await assert.rejects(inspectSyntheticSnapshot('/tmp/real-backup'));
  await fixture(async directory => {
    await writeFile(join(directory, 'firebase-export-metadata.json'), '{"auth":{"path":"auth_export"}}');
    await assert.rejects(sealSyntheticSnapshot(directory));
  });
  if (process.platform !== 'win32') await fixture(async directory => {
    await symlink('/etc/hosts', join(directory, 'private-link')); await assert.rejects(sealSyntheticSnapshot(directory));
  });
});
