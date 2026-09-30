import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

const config = defineConfig({
  resolve: { alias: { '@': projectRoot } },
  test: { environment: 'node' },
});

export default config;
