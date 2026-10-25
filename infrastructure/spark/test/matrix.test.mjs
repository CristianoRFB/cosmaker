import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
test('Spark matrix covers the frozen 47 operations and all 101 existing Functions without inheriting legacy PASS',async()=>{
 const baseline=JSON.parse(await read('docs/implementation/FUNCTIONAL_INVENTORY.json'));
 const matrix=JSON.parse(await read('docs/implementation/spark/COMPATIBILITY.json'));
 const mapped=JSON.parse(await read('docs/implementation/spark/FUNCTIONS_MAP.json'));
 assert.equal(matrix.operations.length,47);assert.deepEqual(matrix.operations.map(o=>o.id),baseline.operations.map(o=>o.id));
 assert.equal(matrix.target.operationsAccepted,0);assert.equal(matrix.target.commercial,'NOT_READY');
 assert.equal(matrix.operations.filter(o=>o.after.status==='PARTIAL_LOCAL').length,matrix.target.operationsPartiallyExercised);
 for(const o of matrix.operations){assert.equal(o.after.dataPreserved,true);assert.equal(o.after.persistenceEquivalent,false);assert.equal(o.after.securityEquivalent,false);assert.equal(o.after.testsEquivalent,false);}
 const names=[...(await read('functions/src/index.ts')).matchAll(/export\s*\{([^}]+)\}\s*from/g)].flatMap(m=>m[1].split(',').map(v=>v.trim()).filter(Boolean));
 assert.equal(mapped.count,101);assert.deepEqual(mapped.functions.map(f=>f.name),names);
 for(const f of mapped.functions){assert.equal(f.productionEnabled,false);assert.equal(createHash('sha256').update(await read(f.source)).digest('hex'),f.sourceSha256);}
});
