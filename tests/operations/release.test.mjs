import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { hashArtifacts, verifyArtifacts } from '../../scripts/operations/prepare-release.mjs';

test('release verifier detects artifact drift and excludes private paths', async () => {
  assert.equal((await hashArtifacts(resolve('.'), ['firestore.rules'])).length, 1);
  const directory = await mkdtemp(join(tmpdir(), 'cosmaker-artifact-'));
  try {
    await writeFile(join(directory, 'artifact.js'), 'synthetic');
    const manifest = { schemaVersion: 1, deploymentExecuted: false, artifacts: await hashArtifacts(directory, ['artifact.js']) };
    assert(await verifyArtifacts(directory, manifest));
    await writeFile(join(directory, 'artifact.js'), 'tampered');
    await assert.rejects(verifyArtifacts(directory, manifest));
    for (const path of ['../outside', '.env.local', '.local/backup.json']) await assert.rejects(hashArtifacts(directory, [path]));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('deployment preparation has no live execution flag', () => {
  const result = spawnSync(process.execPath, ['scripts/operations/prepare-release.mjs', '--execute'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0); assert(result.stderr.includes('nunca executa deploy'));
});
