import { createServer } from 'node:net';

/** Refuse collisions before launching any emulator or browser. Never stop another server. */
export async function assertPortAvailable(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Porta de teste inválida.');
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Porta local ${port} indisponível; nenhum servidor existente será utilizado ou encerrado.`)));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close((error) => error ? reject(error) : resolve()));
  });
}
