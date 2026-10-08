import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const nextCli = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const child = spawn(process.execPath, [nextCli, 'dev', '--hostname', '127.0.0.1'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-cosmaker.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-cosmaker',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-cosmaker.appspot.com',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:cosmaker-demo',
    NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true',
    NEXT_PUBLIC_FIREBASE_EMULATOR_HOST: '127.0.0.1',
  },
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 1));
