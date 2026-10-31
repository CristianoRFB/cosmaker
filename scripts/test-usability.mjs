// Isolated UX checks: only loopback Auth/Firestore and entirely synthetic accounts.
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { assertPortAvailable } from './usability-preflight.mjs';
import { writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

await assertPortAvailable(3100);
const env = { ...process.env, GCLOUD_PROJECT: 'demo-cosmaker', GOOGLE_CLOUD_PROJECT: 'demo-cosmaker', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:19099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:18080', METADATA_SERVER_DETECTION: 'none' };
if (process.argv.includes('--browser')) {
  Object.assign(env, {
    NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-api-key', NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-cosmaker.firebaseapp.com', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-cosmaker', NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:cosmaker-demo', NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-cosmaker.appspot.com', NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true', NEXT_PUBLIC_FIREBASE_EMULATOR_HOST: '127.0.0.1', NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT: '19099', NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT: '18080', NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT: '15001', NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_PORT: '19199', E2E_BASE_URL: 'http://127.0.0.1:3100',
  });
  const server = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3100'], { env, stdio: 'inherit' });
  let serverClosed = false; server.on('exit', () => { serverClosed = true; });
  try {
    let ready = false;
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (serverClosed) throw new Error('Next encerrou antes da inicialização.');
      try { if ((await fetch(env.E2E_BASE_URL + '/login', { signal: AbortSignal.timeout(10_000) })).ok) { if (serverClosed) throw new Error('Next encerrou durante a inicialização.'); ready = true; break; } } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error('Next não inicializou em 120 segundos.');
    const child = spawn(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', 'tests/e2e/usability.spec.ts', ...(env.COSMAKER_USABILITY_GREP ? ['--grep', env.COSMAKER_USABILITY_GREP] : [])], { env, stdio: 'inherit' });
    process.exitCode = await new Promise((resolve) => child.on('exit', (code) => resolve(code ?? 1)));
  } finally {
    if (!serverClosed) {
      const exited = once(server, 'exit');
      if (process.platform === 'win32') {
        await new Promise((resolve) => execFile('taskkill', ['/PID', String(server.pid), '/T', '/F'], () => resolve()));
      } else server.kill('SIGTERM');
      await exited;
    }
  }
} else {
  const config = `firebase.usability-test.${process.pid}.json`;
  await writeFile(config, JSON.stringify({ firestore: { rules: 'firestore.rules' }, emulators: { auth: { host: '127.0.0.1', port: 19099 }, firestore: { host: '127.0.0.1', port: 18080 }, ui: { enabled: false }, singleProjectMode: true } }));
  try {
    const child = spawn(process.execPath, [resolve('node_modules/firebase-tools/lib/bin/firebase.js'), 'emulators:exec', '--project', 'demo-cosmaker', '--config', config, '--only', 'auth,firestore', 'node scripts/test-usability.mjs --browser'], { env, stdio: 'inherit' });
    process.exitCode = await new Promise((resolve) => child.on('exit', (code) => resolve(code ?? 1)));
  } finally { await unlink(config).catch(() => {}); }
}
