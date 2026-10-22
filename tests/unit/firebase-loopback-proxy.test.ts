import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { expect, it } from 'vitest';
const require = createRequire(import.meta.url);
require('../../scripts/firebase-loopback-proxy.cjs');
const { ProxyAgent, request } = require('undici');
it('mantém proxy externo e permite somente loopback literal fora dele', async () => {
  const server = createServer((_req, res) => { res.end('local-only'); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Local port unavailable');
  const proxy = new ProxyAgent({ uri: 'http://127.0.0.1:1' });
  try {
    const response = await request(`http://127.0.0.1:${address.port}`, { dispatcher: proxy });
    expect(await response.body.text()).toBe('local-only');
    // No external request is sent: the configured closed local proxy must still be attempted.
    await expect(request('http://example.invalid', { dispatcher: proxy, headersTimeout: 1000, bodyTimeout: 1000 })).rejects.toThrow();
  } finally { await proxy.close(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
