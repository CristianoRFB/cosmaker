import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const requireFromRoot = createRequire(import.meta.url);
const firebaseCli = requireFromRoot.resolve('firebase-tools/lib/bin/firebase.js');

function findAvailablePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Não foi possível reservar uma porta local.'));
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

const ports = {
  auth: await findAvailablePort(),
  functions: await findAvailablePort(),
  firestore: await findAvailablePort(),
  pubsub: await findAvailablePort(),
};
const baseConfig = JSON.parse(await readFile(new URL('../firebase.commercial-test.json', import.meta.url), 'utf8'));
for (const [name, port] of Object.entries(ports)) baseConfig.emulators[name] = { host: '127.0.0.1', port };
const configName = `firebase.commercial-test.${process.pid}.json`;
const configPath = resolve(configName);
await writeFile(configPath, JSON.stringify(baseConfig, null, 2), 'utf8');

try {
  const exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [
      firebaseCli,
      'emulators:exec',
      '--config', configName,
      '--project', 'demo-cosmaker',
      '--only', 'auth,firestore,functions,pubsub',
      'vitest run tests/integration/commercial-functions.test.ts',
    ], {
      stdio: 'inherit',
      env: {
        ...process.env,
        FUNCTIONS_DISCOVERY_TIMEOUT: '60000',
        FIREBASE_EMULATOR_HOST: '127.0.0.1',
        COSMAKER_AUTH_EMULATOR_PORT: String(ports.auth),
        COSMAKER_FUNCTIONS_EMULATOR_PORT: String(ports.functions),
      },
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolveExit(signal ? 1 : code ?? 1));
  });
  process.exitCode = exitCode;
} catch (error) {
  console.error(`Não foi possível iniciar a suíte do Emulator: ${error instanceof Error ? error.message : 'erro inesperado'}`);
  process.exitCode = 1;
} finally {
  await rm(configPath, { force: true });
}
