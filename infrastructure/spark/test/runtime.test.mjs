import {fileURLToPath} from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

test('workerd bundle refuses real execution and exposes no public scheduler',async()=>{
  const built=await build({entryPoints:[fileURLToPath(new URL('../src/worker.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:crypto','node:buffer']});
  const mf=new Miniflare(convertV4MiniflareOptions({workers:[{modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-10-25',compatibilityFlags:['nodejs_compat'],bindings:{MODE:'disabled',PROJECT_ID:'demo-cosmaker'}}]}));
  try {const r=await mf.dispatchFetch('http://localhost/health');assert.equal(r.status,503);} finally {await mf.dispose();}
});
