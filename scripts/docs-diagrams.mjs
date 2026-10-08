import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argumentsList = process.argv.slice(2);
if (argumentsList.length > 1 || argumentsList.some((argument) => !/^--version=v\d+\.\d+\.\d+$/.test(argument))) {
  throw new Error('Use npm run docs:diagrams -- --version=v0.2.0 ou omita a versão para seguir CURRENT.');
}
const explicitVersion = argumentsList[0]?.slice('--version='.length);
const currentDocument = explicitVersion ? '' : await readFile(join(repositoryRoot, 'docs/CURRENT.md'), 'utf8');
const version = explicitVersion ?? currentDocument.match(/versions\/(v\d+\.\d+\.\d+)\//)?.[1];
if (!version) throw new Error('docs/CURRENT.md não aponta para uma versão documental válida.');
const versionDirectory = `docs/versions/${version}`;
const sourceDirectory = join(repositoryRoot, `${versionDirectory}/diagrams/source`);
const outputDirectory = join(repositoryRoot, `${versionDirectory}/diagrams/rendered`);
const files = (await readdir(sourceDirectory)).filter((name) => name.endsWith('.mmd')).sort();

function parseDiagram(source, file) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const directionLine = lines.shift();
  const direction = directionLine?.match(/^flowchart\s+(TD|TB|LR|RL)$/)?.[1];
  if (!direction) throw new Error(`${file}: use flowchart TD ou flowchart LR.`);
  const nodes = new Map();
  const edges = [];
  const tokenPattern = /([A-Za-z][\w-]*)(?:\[\[(.*?)\]\]|\(\((.*?)\)\)|\{(.*?)\}|\[(.*?)\])/g;

  function addNode(id, label) {
    if (!nodes.has(id)) nodes.set(id, label.replaceAll('"', '').trim());
  }

  for (const line of lines) {
    if (line.startsWith('%%')) continue;
    if (line.includes('-->')) {
      const parts = line.split('-->').map((part) => part.trim());
      if (parts.length !== 2) throw new Error(`${file}: o renderizador aceita uma seta por linha: ${line}`);
      const ids = [];
      for (const part of parts) {
        const match = [...part.matchAll(tokenPattern)][0];
        const id = match?.[1] ?? part.match(/^[A-Za-z][\w-]*$/)?.[0];
        if (!id) throw new Error(`${file}: nó Mermaid não suportado: ${part}`);
        if (match) addNode(id, match[2] ?? match[3] ?? match[4] ?? match[5] ?? id);
        else if (!nodes.has(id)) addNode(id, id);
        ids.push(id);
      }
      edges.push(ids);
      continue;
    }
    const match = [...line.matchAll(tokenPattern)][0];
    if (!match) throw new Error(`${file}: sintaxe Mermaid não suportada: ${line}`);
    addNode(match[1], match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[1]);
  }
  if (!nodes.size) throw new Error(`${file}: o diagrama não contém nós.`);
  return { direction, nodes: [...nodes], edges };
}

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function wrapLabel(label, maximumCharacters = 34) {
  const words = label.split(/\s+/).flatMap((word) => {
    const chunks = [];
    for (let offset = 0; offset < word.length; offset += maximumCharacters) chunks.push(word.slice(offset, offset + maximumCharacters));
    return chunks;
  });
  const lines = [];
  let current = '';
  for (const word of words) {
    if (current && `${current} ${word}`.length > maximumCharacters) { lines.push(current); current = word; }
    else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  return lines;
}

/** Longest-path ranks keep every DAG edge moving in the declared direction. */
function rankNodes(diagram) {
  const nodeOrder = new Map(diagram.nodes.map(([id], index) => [id, index]));
  const parents = new Map(diagram.nodes.map(([id]) => [id, []]));
  const children = new Map(diagram.nodes.map(([id]) => [id, []]));
  for (const [from, to] of diagram.edges) {
    parents.get(to).push(from);
    children.get(from).push(to);
  }
  const remaining = new Map([...parents].map(([id, incoming]) => [id, incoming.length]));
  const queue = diagram.nodes.filter(([id]) => remaining.get(id) === 0).map(([id]) => id);
  const ranks = new Map(queue.map((id) => [id, 0]));
  let visited = 0;
  while (queue.length) {
    const id = queue.shift();
    visited += 1;
    for (const child of children.get(id)) {
      ranks.set(child, Math.max(ranks.get(child) ?? 0, ranks.get(id) + 1));
      remaining.set(child, remaining.get(child) - 1);
      if (remaining.get(child) === 0) queue.push(child);
    }
  }
  if (visited !== diagram.nodes.length) throw new Error('O renderizador por níveis exige DAG; há ciclo na fonte Mermaid.');
  const layers = Array.from({ length: Math.max(...ranks.values()) + 1 }, () => []);
  for (const [id] of diagram.nodes) layers[ranks.get(id)].push(id);
  // Stable barycenters group descendants near their parents without depending on source declaration order.
  const slots = new Map();
  for (const layer of layers) {
    const barycenter = (id) => {
      const incoming = parents.get(id);
      return incoming.length ? incoming.reduce((sum, parent) => sum + slots.get(parent), 0) / incoming.length : nodeOrder.get(id);
    };
    layer.sort((left, right) => barycenter(left) - barycenter(right) || nodeOrder.get(left) - nodeOrder.get(right));
    layer.forEach((id, index) => slots.set(id, (index + 0.5) / layer.length));
  }
  return { layers, ranks, parents, children };
}

function renderSvg(diagram, title) {
  const horizontal = diagram.direction === 'LR' || diagram.direction === 'RL';
  const reversed = diagram.direction === 'RL';
  const { layers, ranks, parents, children } = rankNodes(diagram);
  const wrapped = new Map(diagram.nodes.map(([id, label]) => [id, wrapLabel(label)]));
  const nodeWidth = 280;
  const lineHeight = 20;
  const nodeHeight = Math.max(76, Math.max(...[...wrapped.values()].map((lines) => lines.length)) * lineHeight + 32);
  const mainSize = horizontal ? nodeWidth : nodeHeight;
  const crossSize = horizontal ? nodeHeight : nodeWidth;
  const mainGap = horizontal ? 124 : 88;
  const crossGap = horizontal ? 52 : 56;
  const maxBreadth = Math.max(...layers.map((layer) => layer.length * crossSize + (layer.length - 1) * crossGap));
  const longEdges = diagram.edges.filter(([from, to]) => ranks.get(to) - ranks.get(from) > 1);
  const railPadding = 44 + longEdges.length * 18;
  const mainStart = horizontal ? 48 : 100;
  const crossStart = horizontal ? 96 + railPadding : railPadding;
  const mainExtent = mainStart + layers.length * mainSize + (layers.length - 1) * mainGap + 48;
  const crossExtent = crossStart + maxBreadth + railPadding;
  const width = horizontal ? mainExtent : Math.max(480, crossExtent);
  const height = horizontal ? Math.max(240, crossExtent) : mainExtent;
  const positions = new Map();
  layers.forEach((layer, rank) => {
    const breadth = layer.length * crossSize + (layer.length - 1) * crossGap;
    layer.forEach((id, slot) => positions.set(id, {
      main: mainStart + rank * (mainSize + mainGap),
      cross: crossStart + (maxBreadth - breadth) / 2 + slot * (crossSize + crossGap),
    }));
  });

  const point = (main, cross) => horizontal ? [reversed ? width - main : main, cross] : [cross, main];
  const edgeMarkup = diagram.edges.map(([from, to]) => {
    const a = positions.get(from);
    const b = positions.get(to);
    const out = children.get(from);
    const incoming = parents.get(to);
    const outIndex = out.indexOf(to);
    const inIndex = incoming.indexOf(from);
    const sourcePort = a.cross + crossSize * (outIndex + 1) / (out.length + 1);
    const targetPort = b.cross + crossSize * (inIndex + 1) / (incoming.length + 1);
    const start = a.main + mainSize + 1;
    const end = b.main - 2;
    let route;
    if (ranks.get(to) - ranks.get(from) === 1) {
      const channel = start + (end - start) / 2;
      route = [[start, sourcePort], [channel, sourcePort], [channel, targetPort], [end, targetPort]];
    } else {
      // Skip-level connections travel in reserved outer rails, never through intermediate boxes.
      const railIndex = longEdges.findIndex(([edgeFrom, edgeTo]) => edgeFrom === from && edgeTo === to);
      const preferLeft = targetPort < crossStart + maxBreadth / 2;
      const rail = preferLeft ? crossStart - 20 - railIndex * 18 : crossStart + maxBreadth + 20 + railIndex * 18;
      const exitChannel = start + 20 + outIndex * 10;
      const entryChannel = end - 20 - inIndex * 10;
      route = [[start, sourcePort], [exitChannel, sourcePort], [exitChannel, rail], [entryChannel, rail], [entryChannel, targetPort], [end, targetPort]];
    }
    const points = route.map(([main, cross]) => point(main, cross));
    const path = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
    return `<path data-edge="${escapeXml(from)}:${escapeXml(to)}" d="${path}" fill="none" stroke="#64748b" stroke-width="2" stroke-linejoin="round" marker-end="url(#arrow)"/>`;
  }).join('\n');
  const nodeMarkup = diagram.nodes.map(([id, label]) => {
    const position = positions.get(id);
    const x = horizontal ? reversed ? width - position.main - nodeWidth : position.main : position.cross;
    const y = horizontal ? position.cross : position.main;
    const lines = wrapped.get(id);
    const firstY = y + nodeHeight / 2 - (lines.length - 1) * lineHeight / 2;
    const text = lines.map((line, index) => `<text x="${x + nodeWidth / 2}" y="${firstY + index * lineHeight}" text-anchor="middle" dominant-baseline="middle">${escapeXml(line)}</text>`).join('');
    return `<g data-node="${escapeXml(id)}" data-rank="${ranks.get(id)}"><rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="12" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/><title>${escapeXml(id)}: ${escapeXml(label)}</title>${text}</g>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">${escapeXml(title)}</title><desc id="desc">Diagrama técnico em níveis de dependência, renderizado de fonte Mermaid editável. Conexões chegam às bordas; saltos usam corredores externos.</desc><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L 8 4 L 0 8 Z" fill="#64748b"/></marker></defs><rect width="100%" height="100%" fill="#f8fafc"/><text x="32" y="40" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#1e293b">${escapeXml(title)}</text><g font-family="Arial, sans-serif" font-size="14" fill="#334155">${edgeMarkup}${nodeMarkup}</g></svg>\n`;
}

await mkdir(outputDirectory, { recursive: true });
for (const file of files) {
  const source = await readFile(join(sourceDirectory, file), 'utf8');
  const parsed = parseDiagram(source, file);
  const title = basename(file, '.mmd').replaceAll('-', ' ');
  const outputPath = join(outputDirectory, `${basename(file, '.mmd')}.svg`);
  await writeFile(outputPath, renderSvg(parsed, title));
  console.log(`${versionDirectory}/diagrams/source/${file} -> ${versionDirectory}/diagrams/rendered/${basename(outputPath)}`);
}
