import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const requireFromRoot = createRequire(import.meta.url);
const firebaseCli = requireFromRoot.resolve('firebase-tools/lib/bin/firebase.js');
const vitestCli = resolve(dirname(requireFromRoot.resolve('vitest/package.json')), 'vitest.mjs');
const suites = {
  commercial: 'tests/integration/commercial-functions.test.ts',
  team: 'tests/integration/team-functions.test.ts',
  scheduling: 'tests/integration/scheduling-functions.test.ts',
  inventory: 'tests/integration/inventory-functions.test.ts',
  finance: 'tests/integration/finance-functions.test.ts',
  showcase: 'tests/integration/showcase-functions.test.ts',
  messages: 'tests/integration/messages-functions.test.ts',
  reports: 'tests/integration/reports-functions.test.ts',
  delivery: 'tests/integration/order-finalization-functions.test.ts',
  references: 'tests/integration/quote-reference-functions.test.ts',
  quotes: 'tests/integration/quote-security-functions.test.ts',
  'client-payments': 'tests/integration/client-payments-functions.test.ts',
  'client-quotes': 'tests/integration/client-quotes-functions.test.ts',
  journey: 'tests/integration/integrated-journey-functions.test.ts',
  'order-files': 'tests/integration/order-files-functions.test.ts',
  'order-changes': 'tests/integration/order-change-functions.test.ts',
  'production-photo-bytes': 'tests/integration/production-photo-bytes-functions.test.ts',
  'production-configuration': 'tests/integration/production-configuration-functions.test.ts',
  orders: 'tests/integration/order-files-functions.test.ts tests/integration/order-change-functions.test.ts tests/integration/production-configuration-functions.test.ts tests/integration/scheduling-functions.test.ts',
};
const suiteName = process.argv[2] || 'commercial';
const testFile = suites[suiteName];
if (!testFile) {
  console.error(`Suíte inválida: ${suiteName}. Opções: ${Object.keys(suites).join(', ')}.`);
  process.exit(2);
}
const testCommand = `"${process.execPath}" "${vitestCli}" run ${testFile}${suiteName === 'orders' ? ' --no-file-parallelism --maxWorkers=1' : ''}`;
const withStorage = ['order-files', 'production-configuration', 'orders', 'showcase', 'references', 'journey', 'production-photo-bytes'].includes(suiteName);
// These callable/HTTP suites do not invoke scheduled handlers. Scheduler gates opt in explicitly.
const withPubsub = process.env.COSMAKER_TEST_PUBSUB === 'true';

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
  ...(withPubsub ? { pubsub: await findAvailablePort() } : {}),
  ...(withStorage ? { storage: await findAvailablePort() } : {}),
};
const baseConfig = JSON.parse(await readFile(new URL('../firebase.commercial-test.json', import.meta.url), 'utf8'));
for (const [name, port] of Object.entries(ports)) baseConfig.emulators[name] = { host: '127.0.0.1', port };
const configName = `firebase.commercial-test.${process.pid}.json`;
const configPath = resolve(configName);
await writeFile(configPath, JSON.stringify(baseConfig, null, 2), 'utf8');

try {
  const exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [
      '--require', resolve('scripts/firebase-loopback-proxy.cjs'), firebaseCli,
      ...(process.env.COSMAKER_TEST_DEBUG === 'true' ? ['--debug'] : []),
      'emulators:exec',
      '--config', configName,
      '--project', 'demo-cosmaker',
      '--only', ['auth', 'firestore', 'functions', ...(withPubsub ? ['pubsub'] : []), ...(withStorage ? ['storage'] : [])].join(','),
      testCommand,
    ], {
      stdio: 'inherit',
      env: {
        ...process.env,
        FUNCTIONS_DISCOVERY_TIMEOUT: '60000',
        FIREBASE_EMULATOR_HOST: '127.0.0.1',
        COSMAKER_AUTH_EMULATOR_PORT: String(ports.auth),
        COSMAKER_FUNCTIONS_EMULATOR_PORT: String(ports.functions),
        ...(withStorage ? { COSMAKER_STORAGE_EMULATOR_PORT: String(ports.storage) } : {}),
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
