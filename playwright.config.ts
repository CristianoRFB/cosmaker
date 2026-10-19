import { defineConfig } from '@playwright/test';
import { workflowContextOptions } from './tests/e2e/workflow-context-options';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  expect: { timeout: 60_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3000',
    ...workflowContextOptions(),
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
