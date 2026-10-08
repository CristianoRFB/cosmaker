import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = join(repositoryRoot, 'docs/versions/v0.1.0/diagrams/source');
const outputDirectory = join(repositoryRoot, 'docs/versions/v0.1.0/diagrams/rendered');
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

function renderSvg(diagram, title) {
  const horizontal = diagram.direction === 'LR' || diagram.direction === 'RL';
  const nodeWidth = horizontal ? 190 : 300;
  const nodeHeight = horizontal ? 68 : 58;
  const gapX = horizontal ? 100 : 40;
  const gapY = horizontal ? 40 : 55;
  const columns = horizontal ? Math.min(diagram.nodes.length, 4) : Math.min(diagram.nodes.length, 3);
  const rows = Math.ceil(diagram.nodes.length / columns);
  const width = horizontal ? columns * nodeWidth + (columns + 1) * gapX : columns * nodeWidth + (columns + 1) * gapX;
  const height = rows * nodeHeight + (rows + 1) * gapY + 70;
  const positions = new Map(diagram.nodes.map(([id], index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = gapX + column * (nodeWidth + gapX);
    const y = 60 + gapY + row * (nodeHeight + gapY);
    return [id, { x, y }];
  }));
  const edgeMarkup = diagram.edges.map(([from, to]) => {
    const a = positions.get(from);
    const b = positions.get(to);
    const x1 = a.x + nodeWidth / 2;
    const y1 = a.y + nodeHeight / 2;
    const x2 = b.x + nodeWidth / 2;
    const y2 = b.y + nodeHeight / 2;
    return `<path d="M ${x1} ${y1} L ${x2} ${y2}" fill="none" stroke="#65778b" stroke-width="2" marker-end="url(#arrow)"/>`;
  }).join('\n');
  const nodeMarkup = diagram.nodes.map(([id, label]) => {
    const { x, y } = positions.get(id);
    const maxLine = 25;
    const words = label.split(/\s+/);
    const lines = [];
    let current = '';
    for (const word of words) {
      if (current && `${current} ${word}`.length > maxLine) { lines.push(current); current = word; }
      else current = current ? `${current} ${word}` : word;
    }
    if (current) lines.push(current);
    const firstY = y + nodeHeight / 2 - ((lines.length - 1) * 9);
    const text = lines.map((line, index) => `<text x="${x + nodeWidth / 2}" y="${firstY + index * 18}" text-anchor="middle" dominant-baseline="middle">${escapeXml(line)}</text>`).join('');
    return `<g><rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="12" fill="#ffffff" stroke="#7f91a5" stroke-width="2"/><title>${escapeXml(id)}: ${escapeXml(label)}</title>${text}</g>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">${escapeXml(title)}</title><desc id="desc">Diagrama técnico renderizado a partir de uma fonte Mermaid editável.</desc><defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#65778b"/></marker></defs><rect width="100%" height="100%" fill="#f5f7fa"/><text x="32" y="34" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#263649">${escapeXml(title)}</text><g font-family="Arial, sans-serif" font-size="13" fill="#263649">${edgeMarkup}${nodeMarkup}</g></svg>\n`;
}

await mkdir(outputDirectory, { recursive: true });
for (const file of files) {
  const source = await readFile(join(sourceDirectory, file), 'utf8');
  const parsed = parseDiagram(source, file);
  const title = basename(file, '.mmd').replaceAll('-', ' ');
  const outputPath = join(outputDirectory, `${basename(file, '.mmd')}.svg`);
  await writeFile(outputPath, renderSvg(parsed, title));
  console.log(`docs/versions/v0.1.0/diagrams/source/${file} -> docs/versions/v0.1.0/diagrams/rendered/${basename(outputPath)}`);
}
