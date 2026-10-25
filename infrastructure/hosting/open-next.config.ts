import { defineCloudflareConfig } from './node_modules/@opennextjs/cloudflare/dist/api/config.js';
// Feasibility only: reuse demo-cosmaker launcher. No real Firebase config or R2.
const config = defineCloudflareConfig();
config.buildCommand = 'node scripts/dev-local.mjs build';
export default config;
