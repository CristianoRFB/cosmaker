import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, lstat, readFile, mkdir, writeFile, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, relative, join, dirname, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const required = ['firestore.rules', 'firestore.indexes.json', 'storage.rules', 'firebase.json', 'package.json', 'package-lock.json', 'functions/package.json', 'functions/package-lock.json', 'next.config.mjs', 'scripts/operations/preflight.ps1'];
export async function hashArtifacts(base, paths) {
  const result = [];
  for (const path of [...new Set(paths)].sort()) {
    assert(path && !isAbsolute(path) && !/^[A-Za-z]:/.test(path) && !path.split(/[\\/]/).includes('..'), 'Caminho de artefato deve ser relativo e seguro.');
    const absolute = resolve(base, path);
    assert(!relative(base, absolute).startsWith('..') && !relative(base, absolute).startsWith(sep), 'Artefato fora do checkout.');
    assert.equal(await realpath(absolute), absolute, 'Symlink em caminho de artefato recusado.');
    assert(!/(^|[\\/])\.env(?:[.\\/]|$)|(^|[\\/])\.local[\\/]/.test(path), 'Segredos/dados privados nunca entram no manifesto.');
    const stat = await lstat(absolute); assert(stat.isFile() && !stat.isSymbolicLink(), 'Somente artefatos regulares.');
    const hash = createHash('sha256'); for await (const chunk of createReadStream(absolute)) hash.update(chunk);
    result.push({ path: path.split(sep).join('/'), bytes: stat.size, sha256: hash.digest('hex') });
  }
  return result;
}
export async function verifyArtifacts(base, manifest) {
  assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.deploymentExecuted, false);
  assert.deepEqual(await hashArtifacts(base, manifest.artifacts.map(artifact => artifact.path)), manifest.artifacts, 'Artefatos mudaram; não publicar.');
  return true;
}
async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    assert(!entry.isSymbolicLink(), 'Symlink de build recusado.');
    if (entry.isDirectory()) files.push(...await filesUnder(path)); else files.push(relative(root, path));
  }
  return files;
}
async function main() {
  const args = process.argv.slice(2);
  assert(args.every(arg => /^--(?:write|verify|layer)=/.test(arg)), 'Somente --write=<arquivo>, --verify=<arquivo> ou --layer=<camada>. Este script nunca executa deploy.');
  const value = key => args.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
  if (value('verify')) {
    const manifest = JSON.parse(await readFile(resolve(value('verify')), 'utf8'));
    await verifyArtifacts(root, manifest); console.log('MANIFEST PASS: checksums dos artefatos conferem; homologação real NOT_RUN.'); return;
  }
  const git = (...parameters) => execFileSync('git', parameters, { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(git('branch', '--show-current'), 'codex/cosmaker-master-finalizacao');
  const sourceCommit = git('rev-parse', 'HEAD');
  const paths = [...required, 'functions/lib/index.js', '.next/BUILD_ID', '.next/routes-manifest.json', '.next/required-server-files.json', ...await filesUnder(join(root, 'functions/lib')), ...await filesUnder(join(root, '.next/server')), ...await filesUnder(join(root, '.next/static'))];
  const login = await readFile(join(root, '.next/server/app/login.html'), 'utf8');
  const emulatorBundle = /<meta[^>]*content="emulator"[^>]*name="cosmaker-firebase-mode"/.test(login);
  const manifest = { schemaVersion: 1, candidate: '0.2.0-rc.goal-v.1', canonicalDocumentation: 'v0.2.0', sourceCommit, sourceTree: git('rev-parse', 'HEAD^{tree}'), workingTreeDirty: Boolean(git('status', '--porcelain')), buildId: (await readFile(join(root, '.next/BUILD_ID'), 'utf8')).trim(), nodeMajor: process.versions.node.split('.')[0], buildMode: emulatorBundle ? 'EMULATOR_ONLY_NOT_DEPLOYABLE' : 'PROJECT_CONFIGURATION_REQUIRES_REAL_VERIFICATION', deploymentExecuted: false, realAcceptance: 'NOT_RUN', commercialReadiness: 'NOT_READY', requiredRemoteAuthorization: true, artifacts: await hashArtifacts(root, paths), deployOrder: ['backup-and-preflight', 'firestore:rules', 'storage', 'firestore:indexes', 'functions', 'approved-next-host', 'post-deploy-acceptance'], rollback: 'docs/operations/pre-homologation/PUBLICATION_ROLLBACK.md' };
  if (value('layer')) assert(['functions', 'all'].includes(value('layer')), 'Camada não prevista.');
  if (value('write')) {
    assert(!manifest.workingTreeDirty, 'Preservar código em commit antes de selar candidata.');
    const destination = resolve(value('write'));
    const local = relative(join(root, '.local'), destination);
    assert(local && !local.startsWith('..') && !local.startsWith(sep), 'Manifesto privado deve ficar em .local/.');
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    console.log('Manifesto local criado sem sobrescrita. Deploy e homologação reais NOT_RUN.');
  } else console.log(JSON.stringify({ mode: 'DRY_RUN', ...manifest, artifacts: { count: manifest.artifacts.length }, warning: 'Nenhum comando remoto é executado. Requer decisão de custo, destino, autorização, preflight e backup comprovados.' }, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
