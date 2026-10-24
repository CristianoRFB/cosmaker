import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { relative, resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
async function snapshotFiles(exportDirectory) {
  const directory = resolve(exportDirectory);
  const scope = relative(resolve(root, '.firebase'), directory);
  assert.match(scope.split(sep).join('/'), /^recovery-[a-f0-9]{8}\/export$/, 'Somente export sintético criado pelo harness.');
  assert.equal(await realpath(directory), directory, 'Symlinks não são permitidos no destino.');
  const metadata = JSON.parse(await readFile(join(directory, 'firebase-export-metadata.json'), 'utf8'));
  for (const service of ['auth', 'firestore', 'storage']) assert(metadata[service]?.path, `Export incompleto: ${service}.`);
  const files = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const full = join(path, entry.name); const stat = await lstat(full);
      assert(!stat.isSymbolicLink(), 'Export com symlink recusado.');
      if (stat.isDirectory()) await visit(full);
      else {
        assert(stat.isFile(), 'Tipo de artefato não suportado.');
        const hash = createHash('sha256'); for await (const chunk of createReadStream(full)) hash.update(chunk);
        files.push({ path: relative(directory, full).split(sep).join('/'), bytes: stat.size, sha256: hash.digest('hex') });
        assert(files.length <= 100000, 'Inventário sintético excedeu limite técnico.');
      }
    }
  }
  await visit(directory);
  for (const service of ['auth', 'firestore', 'storage']) {
    const prefix = String(metadata[service].path).replaceAll('\\', '/').replace(/\/$/, '') + '/';
    assert(!prefix.startsWith('/') && !prefix.split('/').includes('..'), 'Metadata de export com caminho inválido.');
    assert(files.some(file => file.path.startsWith(prefix)), `Nenhum artefato de ${service}.`);
  }
  const accounts = JSON.parse(await readFile(join(directory, String(metadata.auth.path), 'accounts.json'), 'utf8'));
  assert(Array.isArray(accounts.users), 'Inventário Auth inválido.');
  const uids = accounts.users.map(user => user.localId);
  assert(uids.every(uid => typeof uid === 'string' && uid.length > 0 && uid.length <= 128) && new Set(uids).size === uids.length, 'UIDs ausentes, malformados ou duplicados.');
  const uidInventorySha256 = createHash('sha256').update(JSON.stringify(uids.sort())).digest('hex');
  return { directory, files: files.sort((a, b) => a.path.localeCompare(b.path, 'en')), authUidCount: uids.length, authUidInventorySha256: uidInventorySha256 };
}
export async function inspectSyntheticSnapshot(directory) {
  const { files } = await snapshotFiles(directory);
  return { projectId: 'demo-cosmaker', syntheticOnly: true, files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), writesExecuted: false };
}
export async function sealSyntheticSnapshot(directory) {
  const snapshot = await snapshotFiles(directory);
  const manifest = { schemaVersion: 1, projectId: 'demo-cosmaker', syntheticOnly: true, authUidCount: snapshot.authUidCount, authUidInventorySha256: snapshot.authUidInventorySha256, files: snapshot.files };
  // Exclusive create: never overwrite an earlier seal or the exported data.
  await writeFile(join(dirname(snapshot.directory), 'snapshot-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  return inspectSyntheticSnapshot(directory);
}
export async function verifySyntheticSnapshot(directory) {
  const snapshot = await snapshotFiles(directory);
  const manifest = JSON.parse(await readFile(join(dirname(snapshot.directory), 'snapshot-manifest.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.projectId, 'demo-cosmaker'); assert.equal(manifest.syntheticOnly, true);
  assert.deepEqual(snapshot.files, manifest.files, 'Snapshot alterado, truncado ou com artefatos extras. Não restaurar.');
  assert.equal(snapshot.authUidCount, manifest.authUidCount); assert.equal(snapshot.authUidInventorySha256, manifest.authUidInventorySha256);
  return inspectSyntheticSnapshot(directory);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [directory, mode = 'inspect'] = process.argv.slice(2);
  assert(directory && ['inspect', '--seal', '--verify'].includes(mode), 'Use <export-dir> [--seal|--verify]; padrão somente leitura.');
  console.log(JSON.stringify(await (mode === '--seal' ? sealSyntheticSnapshot : mode === '--verify' ? verifySyntheticSnapshot : inspectSyntheticSnapshot)(directory)));
}
