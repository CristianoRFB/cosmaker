import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = 'v0.1.0';
const versionDirectory = `docs/versions/${version}`;
const requiredDocuments = [
  'README.md', 'STATUS.md', 'ARCHITECTURE.md', 'DATA_MODEL.md', 'SECURITY.md',
  'FIREBASE_STRUCTURE.md', 'PROJECT_STRUCTURE.md', 'SCREENS.md',
  'GENERATED_VISUALS.md', 'LEADS_OVERVIEW.md',
];
const failures = [];

async function exists(path) {
  try { await stat(resolve(root, path)); return true; } catch { return false; }
}

async function collectMarkdown(directory) {
  const result = [];
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collectMarkdown(path));
    else if (extname(entry.name).toLowerCase() === '.md') result.push(path);
  }
  return result;
}

if (!(await exists('docs/CURRENT.md'))) failures.push('docs/CURRENT.md está ausente.');
else {
  const current = await readFile(resolve(root, 'docs/CURRENT.md'), 'utf8');
  if (!current.includes(versionDirectory)) failures.push(`docs/CURRENT.md deve apontar para ${versionDirectory}.`);
}
for (const document of requiredDocuments) {
  if (!(await exists(`${versionDirectory}/${document}`))) failures.push(`Documento obrigatório ausente: ${versionDirectory}/${document}.`);
}
for (const path of ['docs/DIAGRAMS_MANIFEST.md', 'docs/LEADS_MANIFEST.md']) {
  if (!(await exists(path))) failures.push(`Manifesto obrigatório ausente: ${path}.`);
}

const markdownFiles = await collectMarkdown(versionDirectory);
markdownFiles.push('docs/CURRENT.md', 'docs/DIAGRAMS_MANIFEST.md', 'docs/LEADS_MANIFEST.md');
const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
for (const markdownPath of markdownFiles) {
  const contents = await readFile(resolve(root, markdownPath), 'utf8');
  for (const match of contents.matchAll(linkPattern)) {
    const target = match[1].trim().replace(/^<|>$/g, '').split(/[?#]/, 1)[0];
    if (!target || /^(?:https?:|mailto:|data:|#)/i.test(target)) continue;
    if (target.startsWith('/')) continue;
    const resolved = resolve(root, dirname(markdownPath), decodeURIComponent(target));
    if (!(await exists(resolved))) failures.push(`Link local quebrado em ${markdownPath}: ${target}`);
    if (/screenshots\//i.test(target) && /generated\//i.test(target)) failures.push(`Screenshot não pode apontar para generated/: ${markdownPath} -> ${target}`);
  }
}

const diagramManifest = await readFile(resolve(root, 'docs/DIAGRAMS_MANIFEST.md'), 'utf8').catch(() => '');
const diagramPaths = [...diagramManifest.matchAll(/`(diagrams\/(?:source|rendered)\/[^`]+)`/g)].map((match) => match[1]);
if (!diagramPaths.some((path) => path.startsWith('diagrams/source/'))) failures.push('DIAGRAMS_MANIFEST.md não referencia fontes Mermaid.');
if (!diagramPaths.some((path) => path.startsWith('diagrams/rendered/'))) failures.push('DIAGRAMS_MANIFEST.md não referencia renders SVG.');
for (const path of diagramPaths) if (!(await exists(`${versionDirectory}/${path}`))) failures.push(`Diagrama referenciado ausente: ${versionDirectory}/${path}.`);
const sourceNames = new Set((await readdir(resolve(root, `${versionDirectory}/diagrams/source`))).filter((path) => path.endsWith('.mmd')).map((path) => path.replace(/\.mmd$/, '')));
const renderedNames = new Set((await readdir(resolve(root, `${versionDirectory}/diagrams/rendered`))).filter((path) => path.endsWith('.svg')).map((path) => path.replace(/\.svg$/, '')));
for (const name of sourceNames) {
  if (!renderedNames.has(name)) failures.push(`Render SVG sem par para a fonte ${name}.`);
  if (!diagramPaths.includes(`diagrams/source/${name}.mmd`) || !diagramPaths.includes(`diagrams/rendered/${name}.svg`)) failures.push(`DIAGRAMS_MANIFEST.md deve listar fonte e render de ${name}.`);
}

const screensPath = `${versionDirectory}/SCREENS.md`;
const screens = await readFile(resolve(root, screensPath), 'utf8').catch(() => '');
const screenLinks = [...screens.matchAll(/!?\[[^\]]*\]\((screenshots\/[^)]+\.png)\)/g)].map((match) => match[1]);
if (!screenLinks.length) failures.push('SCREENS.md não referencia screenshots PNG reais.');
if (/generated\//i.test(screens)) failures.push('SCREENS.md mistura material generated/ com screenshots reais.');
for (const path of screenLinks) if (!(await exists(`${versionDirectory}/${path}`))) failures.push(`Screenshot referenciada ausente: ${versionDirectory}/${path}.`);

const firebaseDoc = await readFile(resolve(root, `${versionDirectory}/FIREBASE_STRUCTURE.md`), 'utf8').catch(() => '');
for (const term of ['Auth', 'Firestore', 'Storage', 'Cloud Functions', 'Emulator']) {
  if (!firebaseDoc.toLowerCase().includes(term.toLowerCase())) failures.push(`FIREBASE_STRUCTURE.md não documenta ${term}.`);
}

const visuals = await readFile(resolve(root, `${versionDirectory}/GENERATED_VISUALS.md`), 'utf8').catch(() => '');
if (!/conceitual/i.test(visuals) || !/screenshot/i.test(visuals)) failures.push('GENERATED_VISUALS.md deve distinguir material conceitual de screenshot real.');
for (const match of visuals.matchAll(/`(generated\/[^`]+)`/g)) {
  if (!(await exists(`${versionDirectory}/${match[1]}`))) failures.push(`Visual referenciado ausente: ${versionDirectory}/${match[1]}.`);
}

const leadManifest = await readFile(resolve(root, 'docs/LEADS_MANIFEST.md'), 'utf8').catch(() => '');
const leadOverview = await readFile(resolve(root, `${versionDirectory}/LEADS_OVERVIEW.md`), 'utf8').catch(() => '');
if (!/nenhum lead confirmado/i.test(leadManifest) || !/nenhum lead confirmado/i.test(leadOverview)) failures.push('Manifesto e visão de leads devem refletir a ausência de leads confirmados documentados.');
if (!(await exists(`${versionDirectory}/leads/README.md`))) failures.push('A pasta documental de leads da versão precisa de um README descritivo.');

if (failures.length) {
  console.error(`docs:check encontrou ${failures.length} problema(s):\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`docs:check aprovado: ${versionDirectory}, documentos, links locais, diagramas, screenshots, visuais e Firebase.`);
}
