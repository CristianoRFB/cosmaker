import { createHash } from 'node:crypto';

export function normalizeClientSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function buildClientSearchPrefixes(name: string, email: string) {
  const prefixes = new Set<string>();
  for (const value of [name, email]) {
    const normalized = normalizeClientSearch(value);
    for (let length = 1; length <= Math.min(normalized.length, 64); length += 1) prefixes.add(normalized.slice(0, length));
    for (const word of normalized.split(/\s+/).filter(Boolean)) {
      for (let length = 1; length <= Math.min(word.length, 64); length += 1) prefixes.add(word.slice(0, length));
    }
  }
  return [...prefixes];
}

export function clientEmailIndexId(email: string) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}
