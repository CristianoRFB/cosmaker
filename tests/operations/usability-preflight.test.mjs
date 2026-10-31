import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertPortAvailable } from '../../scripts/usability-preflight.mjs';

test('recusa porta ocupada sem encerrar o servidor existente', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(assertPortAvailable(server.address().port), /nenhum servidor existente/);
    assert.equal(server.listening, true);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
test('aceita porta livre e libera a reserva após diagnóstico', async () => {
  const server = createServer(); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address(); await new Promise((resolve) => server.close(resolve));
  await assertPortAvailable(port); await assertPortAvailable(port);
});
test('recusa portas inválidas antes de abrir socket', async () => {
  for (const port of [0, -1, 65536, '3100']) await assert.rejects(assertPortAvailable(port), /inválida/);
});
