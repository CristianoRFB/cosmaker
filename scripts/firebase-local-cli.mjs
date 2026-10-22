import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const child = spawn(process.execPath, ['--require', fileURLToPath(new URL('./firebase-loopback-proxy.cjs', import.meta.url)), require.resolve('firebase-tools/lib/bin/firebase.js'), ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
child.once('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.once('exit', (code, signal) => { process.exitCode = signal ? 1 : code ?? 1; });
