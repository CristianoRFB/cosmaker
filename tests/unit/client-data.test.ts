import { describe, expect, it } from 'vitest';
import { buildClientSearchPrefixes, clientEmailIndexId, normalizeClientSearch } from '../../functions/src/clients/client-data';

describe('client search and email index helpers', () => {
  it('normalizes accents and case without changing the stored display name', () => {
    expect(normalizeClientSearch('  MARÍNA   COSTA  ')).toBe('marina costa');
  });

  it('builds prefixes for the full name, each name part, and email', () => {
    const prefixes = buildClientSearchPrefixes('Marina Costa', 'marina@example.test');
    expect(prefixes).toContain('marina');
    expect(prefixes).toContain('cos');
    expect(prefixes).toContain('marina@');
    expect(prefixes).not.toContain('costa marina');
  });

  it('creates a stable opaque email index key', () => {
    const first = clientEmailIndexId(' Marina@Example.Test ');
    expect(first).toBe(clientEmailIndexId('marina@example.test'));
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain('marina');
  });
});
