import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve('scripts/operations/preflight.ps1');
const executable = process.env.COSMAKER_PWSH || 'pwsh';
const head = 'a'.repeat(40);
function sample() {
  const target = JSON.parse(readFileSync('docs/operations/pre-homologation/target.example.json'));
  Object.assign(target, { projectId: 'demo-cosmaker', projectNumber: '123456789012', operatorEmail: 'operator@cosmaker.test', storageBucket: 'demo-cosmaker.appspot.com', appOrigin: 'https://cosmaker.invalid', hostingMode: 'NEXT_NODE', costPolicy: 'USAGE_BASED_EXPLICITLY_AUTHORIZED', billingAuthorizationReference: 'SYNTHETIC_APPROVAL_NOT_REAL' });
  const fixture = { syntheticOnly: true, projectId: 'demo-cosmaker', probes: {
    node: 'v22.23.4', npm: '10.9.9', java: 'openjdk version "21.0.12.1"', git: 'git version 2.50.0', firebase: '15.34.1',
    origin: target.repository, branch: target.branch, head, status: '', gcloud: '{}',
    identity: JSON.stringify([{ account: target.operatorEmail, status: 'ACTIVE' }]), firebaseIdentity: `Logged in as ${target.operatorEmail}`,
    project: JSON.stringify({ projectId: target.projectId, projectNumber: target.projectNumber, lifecycleState: 'ACTIVE' }),
    firebaseProject: JSON.stringify({ status: 'success', result: [{ projectId: target.projectId, projectNumber: target.projectNumber }] }),
    billing: '{"billingEnabled":true}', services: JSON.stringify(target.requiredServices.map(name => ({ config: { name } }))),
    bucket: JSON.stringify({ name: target.storageBucket, project_number: target.projectNumber }), iam: '{"bindings":[]}',
    database: JSON.stringify({ name: `projects/${target.projectId}/databases/(default)`, type: 'FIRESTORE_NATIVE' }),
  } };
  return { target, fixture };
}
function run(change = () => {}, extra = []) {
  const directory = mkdtempSync(join(tmpdir(), 'cosmaker preflight '));
  try {
    const sampleData = sample(); change(sampleData);
    const target = join(directory, 'target.json'); const fixture = join(directory, 'fixture.json');
    writeFileSync(target, JSON.stringify(sampleData.target)); writeFileSync(fixture, JSON.stringify(sampleData.fixture));
    const result = spawnSync(executable, ['-NoLogo', '-NoProfile', '-File', script, '-TargetFile', target, '-FixturePath', fixture, ...extra], { encoding: 'utf8', timeout: 30_000 });
    assert.ifError(result.error);
    assert(!result.stdout.includes('operator@cosmaker.test'), 'Relatório não exporta identidade pessoal.');
    return { ...result, report: result.stdout.trim().startsWith('{') ? JSON.parse(result.stdout) : null };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
test('PowerShell7: synthetic full diagnostics cannot approve production or deploy', () => {
  const result = run(); assert.equal(result.status, 0, result.stderr);
  assert.equal(result.report.status, 'SYNTHETIC_PASS');
  assert.equal(result.report.evidenceKind, 'SYNTHETIC');
  assert.equal(result.report.deployExecuted, false); assert.equal(result.report.readyForProduction, false);
  assert.equal(result.report.head, head); assert(result.report.manualGates.length >= 8);
});
test('PowerShell7: refuses identity/tenant/config/cost and tool drift instead of assuming defaults', () => {
  for (const change of [
    ({ fixture }) => { fixture.probes.identity = '[{"account":"foreign@cosmaker.test","status":"ACTIVE"}]'; },
    ({ fixture }) => { fixture.probes.project = '{"projectId":"demo-foreign","projectNumber":"2","lifecycleState":"ACTIVE"}'; },
    ({ fixture }) => { fixture.probes.firebaseIdentity = 'Logged in as foreign@cosmaker.test'; },
    ({ fixture }) => { fixture.probes.billing = ''; },
    ({ fixture }) => { fixture.probes.services = '[]'; },
    ({ fixture }) => { fixture.probes.bucket = '{"name":"foreign.appspot.com"}'; },
    ({ fixture }) => { fixture.probes.bucket = '{"name":"demo-cosmaker.appspot.com","project_number":"987654321098"}'; },
    ({ fixture }) => { fixture.probes.database = '{"name":"projects/demo-foreign/databases/(default)","type":"FIRESTORE_NATIVE"}'; },
    ({ fixture }) => { fixture.probes.status = ' M private-file'; fixture.probes.branch = 'main'; },
    ({ fixture }) => { fixture.probes.node = 'v24.0.0'; },
    ({ target }) => { target.costPolicy = 'ZERO_BILLING'; },
    ({ target }) => { target.region = 'southamerica-east1'; },
  ]) {
    const result = run(change); assert.equal(result.status, 2, result.stderr);
    assert.equal(result.report.status, 'BLOCKED'); assert(result.report.blocked > 0);
  }
});
test('PowerShell7: fixtures cannot address real projects or enable live probes', () => {
  assert.notEqual(run(({ fixture }) => { fixture.syntheticOnly = false; }).status, 0);
  assert.notEqual(run(({ target }) => { target.projectId = 'real-project-not-authorized'; }).status, 0);
  assert.notEqual(run(() => {}, ['-InspectRemote']).status, 0);
});
