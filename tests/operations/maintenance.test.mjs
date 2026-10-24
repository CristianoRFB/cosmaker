import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { maintenanceIntent } from '../../scripts/operations/maintenance-safety.mjs';

test('legacy entrypoints default to offline dry-run even with real-looking credentials', () => {
  for (const script of ['provision-platform-admin.mjs', 'migrate-public-tenant-slug.mjs']) {
    const result = spawnSync(process.execPath, [`scripts/${script}`], { encoding: 'utf8', env: { ...process.env, FIREBASE_ADMIN_PROJECT_ID: 'not-a-real-authorized-project', COSMAKER_ADMIN_EMAIL: 'private@cosmaker.test', FIREBASE_ADMIN_PRIVATE_KEY: 'never-read-or-print-this-sentinel' } });
    assert.equal(result.status, 0, result.stderr); const data = JSON.parse(result.stdout);
    assert.equal(data.mode, 'DRY_RUN'); assert.equal(data.remoteContacted, false); assert.equal(data.writesExecuted, false);
    assert(!result.stdout.includes('private@') && !result.stdout.includes('sentinel'));
  }
});
test('maintenance refuses mixed endpoints and implicit production writes', () => {
  const base = { operation: 'test', projectId: 'demo-cosmaker', services: ['HOST'], args: ['--apply'], env: { HOST: '127.0.0.1:18080' } };
  assert.equal(maintenanceIntent(base).mode, 'EMULATOR_APPLY');
  for (const patch of [{ projectId: 'another-project' }, { env: { HOST: '192.0.2.1:8080' } }, { env: {} }, { env: { HOST: '127.0.0.1:99999' } }]) assert.throws(() => maintenanceIntent({ ...base, ...patch }));
  assert.throws(() => maintenanceIntent({ ...base, projectId: 'a-real-project', env: {}, args: ['--apply', '--confirm-project=a-real-project'] }));
});
