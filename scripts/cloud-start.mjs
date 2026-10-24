import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { createServer } from 'node:net';
import { stripVTControlCharacters } from 'node:util';
import { captureProcessTree, processIdentity, signalProcessTree } from './cloud-process-tree.mjs';
const mode = process.argv[2] || 'dev';
if (!['dev', 'start'].includes(mode)) throw new Error('Use dev ou start. Build separado: bash scripts/cloud-run.sh npm run build:local.');
// Fail before spawning anything if another runtime owns any required port.
for (const port of [19099, 18080, 19199, 15001, 8085, 14403, 14404, 3000]) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(new Error(`Porta local ${port} ocupada. Preserve o runtime existente; encerre-o antes de iniciar outro.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}
mkdirSync('.firebase', { recursive: true });
const log = createWriteStream('.firebase/cloud-emulators.log', { flags: 'w' });
const launcher = processIdentity(process.pid);
if (!launcher) throw new Error('Não foi possível identificar o lançador Linux em /proc.');
let owned = [launcher];
function snapshot() { owned = captureProcessTree(owned); }
const monitor = setInterval(snapshot, 1000);
monitor.unref();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  snapshot();
  signalProcessTree(owned.filter(({ pid }) => pid !== process.pid), 'SIGTERM');
  setTimeout(() => {
    snapshot();
    signalProcessTree(owned.filter(({ pid }) => pid !== process.pid), 'SIGKILL');
    clearInterval(monitor);
    process.exit(code);
  }, 5000);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop());
function run(script, stdio = 'inherit') {
  const child = spawn('npm', ['run', script], { stdio, env: process.env, detached: true });
  child.once('error', (error) => { console.error(error.message); stop(1); });
  return child;
}
const emulators = run('firebase:emulators:local', ['ignore', 'pipe', 'pipe']);
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Emuladores não ficaram prontos em 180s. Consulte .firebase/cloud-emulators.log.')), 180000);
    let recent = '';
    for (const stream of [emulators.stdout, emulators.stderr]) stream.on('data', (chunk) => {
      log.write(chunk); process.stdout.write(chunk);
      recent = (recent + stripVTControlCharacters(chunk.toString())).slice(-4096);
      if (recent.includes('All emulators ready!')) { clearTimeout(timeout); resolve(); }
    });
    emulators.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Emuladores encerraram antes da prontidão (${code}).`)); });
  });
  emulators.once('exit', (code) => { if (!stopping) stop(code || 1); });
  const seed = run('seed:emulator');
  await new Promise((resolve, reject) => seed.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Seed local falhou (${code}).`))));
  const web = run(mode === 'dev' ? 'dev:local' : 'start:local');
  web.once('exit', (code) => { if (!stopping) stop(code || 1); });
} catch (error) { console.error(error.message); stop(1); }
