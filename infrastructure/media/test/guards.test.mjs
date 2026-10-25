import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MediaCoordinator} from '../src/coordinator.mjs';
import {RtdbChunkProvider,SupabaseStorageAdapter,hashBytes} from '../src/storage.mjs';
const root=new URL('../../../',import.meta.url);
test('isolated proof flags are OFF and all provider origins reject real services',()=>{
 const provider=new RtdbChunkProvider('http://127.0.0.1:19000');
 assert.throws(()=>new MediaCoordinator({db:{},provider}),/flag OFF/);
 assert.throws(()=>new MediaCoordinator({db:{},provider,enabled:true,project:'real-project'}),/non-synthetic/);
 assert.throws(()=>new RtdbChunkProvider('https://real.firebaseio.com'),/loopback/);
 assert.throws(()=>new SupabaseStorageAdapter('https://real.supabase.co','not-a-credential'),/loopback/);
 for(const origin of['http://127.0.0.1.evil:80','http://user@127.0.0.1:19000','http://127.0.0.1:19000/redirect'])assert.throws(()=>new RtdbChunkProvider(origin));
});
test('47 operations and all baseline upload source hashes are preserved; no automatic equivalence credit',async()=>{
 const inventory=JSON.parse(await readFile(new URL('docs/implementation/media-lifecycle/MEDIA_INVENTORY.json',root),'utf8'));
 for(const entry of inventory.sourceFiles){const bytes=(await readFile(new URL(entry.file,root),'utf8')).replaceAll('\r\n','\n');assert.equal(hashBytes(bytes),entry.sha256,entry.file+' changed without revalidation');}
 const matrix=JSON.parse(await readFile(new URL('docs/implementation/media-lifecycle/OPERATIONS_47.json',root),'utf8'));
 assert.equal(matrix.operations.length,47);assert.equal(new Set(matrix.operations.map(o=>o.id)).size,47);assert.equal(matrix.target.operationsAccepted,0);
 assert.ok(matrix.operations.every(o=>o.goalVII.storageCutover===false&&o.goalVII.retentionCutover===false&&o.goalVII.dataPreserved===true));
 const evidence=JSON.parse(await readFile(new URL('docs/implementation/media-lifecycle/EVIDENCE.json',root),'utf8'));
 for(const entry of evidence.sourceHashes){const content=(await readFile(new URL(entry.file,root),'utf8')).replaceAll('\r\n','\n');assert.equal(hashBytes(content),entry.sha256,entry.file+' is not the evidenced source');}
 const acceptance=JSON.parse(await readFile(new URL('docs/implementation/media-lifecycle/ACCEPTANCE.json',root),'utf8'));
 assert.equal(acceptance.gates.length,7);assert.equal(acceptance.accepted+acceptance.partial+acceptance.blocked,7);assert.equal(acceptance.storageCutover,false);
});
