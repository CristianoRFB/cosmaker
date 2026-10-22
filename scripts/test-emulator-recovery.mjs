import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const nonce = randomBytes(4).toString('hex');
const directory = resolve('.firebase', `recovery-${nonce}`); await mkdir(directory, { recursive: true });
const used = new Set();
async function port() {
  const value = await new Promise((resolvePort, reject) => {
    const server = createServer(); server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close((error) => error ? reject(error) : resolvePort(value)); });
  });
  if (used.has(value)) return port(); used.add(value); return value;
}
const config = { firestore: { rules: resolve('firestore.rules'), indexes: resolve('firestore.indexes.json') }, storage: { rules: resolve('storage.rules') }, emulators: { ui: { enabled: false } } };
for (const name of ['auth', 'firestore', 'storage', 'hub', 'logging']) config.emulators[name] = { host: '127.0.0.1', port: await port() };
const configPath = resolve(directory, 'firebase.json'); await writeFile(configPath, JSON.stringify(config));
const exportPath = resolve(directory, 'export');
for (const phase of ['write', 'verify']) {
  const args = ['scripts/firebase-local-cli.mjs', 'emulators:exec', '--project', 'demo-cosmaker', '--config', configPath, '--only', 'auth,firestore,storage', ...(phase === 'verify' ? ['--import', exportPath] : []), `"${process.execPath}" scripts/emulator-recovery-fixture.mjs`];
  const code = await new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, COSMAKER_RECOVERY_RUN: nonce, COSMAKER_RECOVERY_PHASE: phase, COSMAKER_RECOVERY_CONFIG: configPath, COSMAKER_RECOVERY_EXPORT: exportPath } });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
    child.once('error', reject); child.once('exit', (code) => resolveExit(code ?? 1));
  });
  if (code !== 0) { process.exitCode = code; break; }
}
if (!process.exitCode) console.log(`RECOVERY PASS: exportação e importação em instâncias novas, Auth/Firestore/Storage e ACL A/B verificados. Artefatos fictícios em ${directory}.`);
