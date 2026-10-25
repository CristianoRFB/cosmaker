import {fileURLToPath} from 'node:url';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions, fetch as runtimeFetch } from 'miniflare';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
const requireAdmin=createRequire(new URL('../../../functions/package.json',import.meta.url));
const {initializeApp:adminInit,deleteApp:adminDelete}=requireAdmin('firebase-admin/app');
const {getAuth:adminAuth}=requireAdmin('firebase-admin/auth');
const {getFirestore}=requireAdmin('firebase-admin/firestore');
const projectId='demo-cosmaker';
for(const key of ['FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','FIREBASE_DATABASE_EMULATOR_HOST']) if(!/^127\.0\.0\.1:\d+$/.test(process.env[key]||'')) throw Error('Only loopback emulators permitted: '+key);
if(process.env.GCLOUD_PROJECT!==projectId) throw Error('Only demo-cosmaker permitted');
const nonce=randomUUID().slice(0,8),a=`spark-${nonce}-a`,b=`spark-${nonce}-b`;
const app=adminInit({projectId},'spark-admin-'+nonce),db=getFirestore(app),auth=adminAuth(app);
const env={MODE:'emulator',PROJECT_ID:projectId,AUTH_ORIGIN:'http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST,FIRESTORE_ORIGIN:'http://'+process.env.FIRESTORE_EMULATOR_HOST,DATABASE_ORIGIN:'http://'+process.env.FIREBASE_DATABASE_EMULATOR_HOST,FILE_GLOBAL_BYTES:'100000000',FILE_TENANT_BYTES:'50000000',FILE_MONTHLY_BYTES:'1000000000'};
let mf;const people={},clients=[];let mutateAfterObjectPut=null;
const hash=b=>createHash('sha256').update(b).digest('hex');
const payload=(extra={})=>({requestId:randomUUID(),kind:'expense',basis:'actual',category:'materials',amountCents:1234,description:'Material sintético',effectiveDate:new Date().toISOString().slice(0,10),orderId:'order-a',...extra});
async function call(name,data,who='ownerA') {
  const r=await mf.dispatchFetch('http://localhost/'+name,{method:'POST',headers:{Authorization:'Bearer '+(people[who]?.token||'invalid'),'Content-Type':'application/json'},body:JSON.stringify({data})});
  return {status:r.status,subrequests:Number(r.headers.get('X-Spark-Subrequests')),...await r.json()};
}
async function fileUpload(bytes,requestId=randomUUID(),who='ownerA',extras={}) {
  const r=await mf.dispatchFetch(`http://localhost/files/${a}/order-a`,{method:'POST',headers:{Authorization:'Bearer '+people[who].token,'Content-Type':'application/pdf','x-request-id':requestId,'x-content-sha256':hash(bytes),...extras},body:bytes});
  return {status:r.status,subrequests:Number(r.headers.get('X-Spark-Subrequests')),...await r.json()};
}
async function fileGet(id,who='clientA',tenant=a) {return mf.dispatchFetch(`http://localhost/files/${tenant}/order-a/${id}`,{headers:{Authorization:'Bearer '+people[who].token}});}
async function rtdb(path,method='GET',value) {
  const r=await fetch(`${env.DATABASE_ORIGIN}/${path}.json?ns=demo-cosmaker-default-rtdb`,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},...(value===undefined?{}:{body:JSON.stringify(value)})});
  assert.equal(r.ok,true,'RTDB fixture operation failed '+r.status);return r.json();
}
before(async()=>{
  const built=await build({entryPoints:[fileURLToPath(new URL('../src/worker.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:crypto','node:buffer']});
  mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'spark-proof',modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-10-25',compatibilityFlags:['nodejs_compat'],bindings:env,outboundService:async request=>{
    const r=await runtimeFetch(request);
    if(mutateAfterObjectPut&&request.method==='PUT'&&new URL(request.url).pathname.startsWith('/spark/objects/')){const action=mutateAfterObjectPut;mutateAfterObjectPut=null;await action();}
    return r;
  }}]}));
  await mf.ready;
  for(const [name,tenant,role,permissions] of [['ownerA',a,'owner',[]],['ownerB',b,'owner',[]],['reader',a,'assistant',['orders:read']],['clientA',null,null,[]],['clientOther',null,null,[]],['revoked',a,'owner',[]]]) {
    const email=`${name}-${nonce}@cosmaker.test`,password='Synthetic!Password123';
    const u=await auth.createUser({email,password,emailVerified:true});
    await db.doc(`users/${u.uid}`).set({active:true,accountType:tenant?'atelier_member':'client',...(tenant?{atelierId:tenant}:{})});
    if(tenant) await db.doc(`ateliers/${tenant}/members/${u.uid}`).set({active:true,role,permissions});
    const client=initializeApp({apiKey:'emulator-only-key',projectId,authDomain:projectId+'.firebaseapp.com',appId:'emulator-only-app'},name+nonce);clients.push(client);
    const clientAuth=getAuth(client);connectAuthEmulator(clientAuth,env.AUTH_ORIGIN,{disableWarnings:true});
    const signed=await signInWithEmailAndPassword(clientAuth,email,password);people[name]={uid:u.uid,token:await signed.user.getIdToken()};
  }
  for(const tenant of[a,b]) await db.doc(`ateliers/${tenant}`).set({active:true});
  await db.doc(`ateliers/${a}/orders/order-a`).set({atelierId:a,status:'confirmed',clientUserId:people.clientA.uid,quoteId:'original',description:'Synthetic armor',expectedDeliveryDate:'2027-01-10',approvedQuoteSnapshot:{total:1000,depositAmount:300},amountPaid:300,amountPaidCents:30000,amountRemaining:700,amountRemainingCents:70000});
  await db.doc(`ateliers/${b}/orders/order-b`).set({atelierId:b,status:'confirmed'});
  await rtdb('spark','DELETE');
}, {timeout:60000});
after(async()=>{await mf?.dispose();await Promise.all(clients.map(deleteApp));await adminDelete(app);});

test('Worker Auth -> Firestore REST: authorized workspace, invalid token, privilege and tenant injection',async()=>{
  const ok=await call('getTenantWorkspace',{});assert.equal(ok.status,200);assert.deepEqual(ok.data,{atelierId:a,role:'owner'});
  const missing=await call('getTenantWorkspace',{},'none');assert.equal(missing.status,401);
  assert.equal((await call('recordFinanceEntry',payload(),'reader')).status,403);
  assert.equal((await call('recordFinanceEntry',payload(),'clientA')).status,403);
  assert.equal((await call('recordFinanceEntry',payload({atelierId:b}))).error.status,'INVALID_ARGUMENT');
  assert.equal((await call('recordFinanceEntry',payload(),'ownerB')).error.status,'NOT_FOUND');
});
test('Real Firestore REST commit: financial cents, canonical schemas, transaction retry, replay and unique audit',async()=>{
  const p=payload({kind:'payment',amountCents:40000,method:'pix',reference:'synthetic-first'});
  const results=await Promise.all([call('recordFinanceEntry',p),call('recordFinanceEntry',p)]);
  for(const r of results) assert.equal(r.status,200,JSON.stringify(r));
  assert.equal(results.filter(r=>r.data.alreadyApplied===false).length,1);
  assert.equal(new Set(results.map(r=>r.data.entryId)).size,1);
  const entryId=results[0].data.entryId;
  const order=(await db.doc(`ateliers/${a}/orders/order-a`).get()).data();assert.equal(order.amountPaidCents,70000);assert.equal(order.amountRemainingCents,30000);
  const entry=(await db.doc(`ateliers/${a}/financeEntries/${entryId}`).get()).data();assert.equal(entry.actorId,people.ownerA.uid);assert.equal(entry.amountCents,40000);assert.equal(entry.paymentId,entryId);assert.ok(entry.createdAt.toDate());
  const audits=await db.collection('auditLogs').where('entityId','==',entryId).get();assert.equal(audits.size,1);
  assert.equal((await call('recordFinanceEntry',{...p,amountCents:1})).error.status,'FAILED_PRECONDITION');
  assert.equal((await call('recordFinanceEntry',{...p,requestId:randomUUID()})).error.status,'ALREADY_EXISTS');
  const competing=await Promise.all([1,2].map(n=>call('recordFinanceEntry',payload({kind:'payment',amountCents:20000,method:'pix',reference:'competing-'+n}))));
  assert.equal(competing.filter(r=>r.status===200).length,1,JSON.stringify(competing));
  assert.equal((await db.doc(`ateliers/${a}/orders/order-a`).get()).get('amountPaidCents'),90000);
}, {timeout:60000});
test('Validation rejects unsafe cents, invalid dates and actor overrides',async()=>{
  for(const patch of [{amountCents:1.5},{amountCents:-1},{amountCents:9007199254740992},{effectiveDate:'2026-02-31'},{actorId:people.ownerB.uid}]) assert.equal((await call('recordFinanceEntry',payload(patch))).error.status,'INVALID_ARGUMENT');
});
test('Current Auth state: disabled, revoked and membership removal deny cached sessions',async()=>{
  await auth.updateUser(people.revoked.uid,{disabled:true});assert.equal((await call('getTenantWorkspace',{},'revoked')).status,401);
  await auth.updateUser(people.revoked.uid,{disabled:false,validSince:Math.floor(Date.now()/1000)+2});
  assert.equal((await call('getTenantWorkspace',{},'revoked')).status,401);
  await db.doc(`ateliers/${a}/members/${people.reader.uid}`).update({active:false});assert.equal((await call('getTenantWorkspace',{},'reader')).status,403);
});
let uploaded;
const pdf=Buffer.from('%PDF-1.7\nSYNTHETIC PRIVATE DOCUMENT\n%%EOF');
test('Private RTDB upload: actual bytes, immutable retry, audit and authorized UID download',async()=>{
  const key=randomUUID();uploaded=await fileUpload(pdf,key);assert.equal(uploaded.status,200,JSON.stringify(uploaded));
  const retry=await fileUpload(pdf,key);assert.equal(retry.status,200);assert.equal(retry.data.alreadyApplied,true);
  const changed=await fileUpload(Buffer.from('%PDF-changed'),key);assert.equal(changed.error.status,'FAILED_PRECONDITION');
  const got=await fileGet(uploaded.data.fileId);assert.equal(got.status,200);assert.equal(got.headers.get('cache-control'),'private, no-store');assert.equal(hash(Buffer.from(await got.arrayBuffer())),hash(pdf));
  const audits=await db.collection('auditLogs').where('action','==','spark.file_ready').get();assert.equal(audits.size,1);
});
test('RTDB denies direct reads/writes with no auth or a valid Firebase client token; client A/B and durable UID ownership',async()=>{
  const path=`${env.DATABASE_ORIGIN}/spark/objects/${a}/${uploaded.data.fileId}.json?ns=demo-cosmaker-default-rtdb`;
  for(const suffix of ['', '&auth='+encodeURIComponent(people.clientA.token)]) {const r=await fetch(path+suffix);assert.ok([401,403].includes(r.status), 'RTDB denial: '+r.status+' '+await r.text());}
  const raw=await fetch(path,{method:'PUT',headers:{'Content-Type':'application/json'},body:'"tampered"'});assert.ok([401,403].includes(raw.status));
  assert.equal((await fileGet(uploaded.data.fileId,'clientOther')).status,403);
  assert.equal((await fileGet(uploaded.data.fileId,'ownerB')).status,403);
  assert.equal((await fileGet(uploaded.data.fileId,'clientA',b)).status,403);
});
test('SHA/MIME failures, interrupted/pending upload and immutable create are not silently accepted',async()=>{
  assert.equal((await fileUpload(pdf,randomUUID(),'ownerA',{'x-content-sha256':'0'.repeat(64)})).error.status,'INVALID_ARGUMENT');
  assert.equal((await fileUpload(Buffer.from('not a PDF'))).error.status,'INVALID_ARGUMENT');
  assert.equal((await fileUpload(pdf,randomUUID(),'ownerA',{'Content-Type':'image/png'})).error.status,'INVALID_ARGUMENT');
  const key=randomUUID(),fileId=hash(JSON.stringify([a,'order-a',people.ownerA.uid,key]));
  const fingerprint=hash(JSON.stringify([hash(pdf),'application/pdf',pdf.length]));
  await db.doc(`ateliers/${a}/orders/order-a/sparkFiles/${fileId}`).set({status:'pending',fingerprint,leaseId:'old-interrupted',leaseUntil:new Date(Date.now()+60000)});
  assert.equal((await fileUpload(pdf,key)).error.status,'ABORTED');
  assert.equal((await fileGet(fileId)).status,403);
  await db.doc(`ateliers/${a}/orders/order-a/sparkFiles/${fileId}`).update({leaseUntil:new Date(0)});
  const resumed=await fileUpload(pdf,key);assert.equal(resumed.status,200,JSON.stringify(resumed));
});
test('Storage/global/tenant/monthly quota failure is closed and retains prior data',async()=>{
  const old=await rtdb('spark/quota');
  await rtdb('spark/quota','PUT',{...old,stored:Number(env.FILE_GLOBAL_BYTES)});
  assert.equal((await fileUpload(pdf)).error.status,'RESOURCE_EXHAUSTED');
  await rtdb('spark/quota','PUT',{...old,tenants:{...old.tenants,[a]:Number(env.FILE_TENANT_BYTES)}});
  assert.equal((await fileUpload(pdf)).error.status,'RESOURCE_EXHAUSTED');
  const month=new Date().toISOString().slice(0,7);
  await rtdb('spark/quota','PUT',{...old,months:{[month]:Number(env.FILE_MONTHLY_BYTES)}});
  assert.equal((await fileGet(uploaded.data.fileId)).status,429);
  await rtdb('spark/quota','PUT',old);
  assert.equal((await fileGet(uploaded.data.fileId)).status,200);
});
test('Private integrity and revocation are checked on each read',async()=>{
  const path=`spark/objects/${a}/${uploaded.data.fileId}`,old=await rtdb(path);
  await rtdb(path,'PUT',{...old,base64:Buffer.from('%PDF-altered').toString('base64')});
  assert.equal((await fileGet(uploaded.data.fileId)).status,400);
  await rtdb(path,'PUT',old);
  await db.doc(`users/${people.clientA.uid}`).update({active:false});assert.equal((await fileGet(uploaded.data.fileId)).status,403);
  await db.doc(`users/${people.clientA.uid}`).update({active:true});
  await db.doc(`ateliers/${a}/orders/order-a/sparkFiles/${uploaded.data.fileId}`).update({visibleToClient:false});assert.equal((await fileGet(uploaded.data.fileId)).status,403);
});
test('ScheduledEvent in workerd: advance invalid legacy pages, UTC boundaries, A/B, replay, concurrent dispatch and unique audits',async()=>{
  const today=new Date().toISOString().slice(0,10),past='2020-01-01';
  const batch=db.batch();
  for(let i=0;i<100;i++) batch.set(db.doc(`ateliers/${a}/quotes/legacy-${String(i).padStart(3,'0')}`),{status:'sent',validUntil:'0000-invalid',requestId:'legacy',total:10});
  for(const [tenant,key,validUntil] of [[a,'past-a',past],[b,'past-b',past],[a,'today',today],[a,'future','2099-01-01']]) {
    batch.set(db.doc(`ateliers/${tenant}/quotes/${key}`),{status:'sent',validUntil,requestId:key,total:100});
    batch.set(db.doc(`ateliers/${tenant}/quoteRequests/${key}`),{activeQuoteId:key,status:'quoted'});
  }
  batch.set(db.doc('foreign/namespace/quotes/foreign'),{status:'sent',validUntil:past,total:100,requestId:'foreign'});await batch.commit();
  const worker=await mf.getWorker('spark-proof');
  for(let i=0;i<10;i++) assert.equal((await worker.scheduled({scheduledTime:new Date(),cron:'* * * * *'})).outcome,'ok');
  await Promise.all([worker.scheduled({scheduledTime:new Date(),cron:'* * * * *'}),worker.scheduled({scheduledTime:new Date(),cron:'* * * * *'})]);
  for(const [tenant,key] of [[a,'past-a'],[b,'past-b']]) {assert.equal((await db.doc(`ateliers/${tenant}/quotes/${key}`).get()).get('status'),'expired');assert.equal((await db.doc(`ateliers/${tenant}/quoteRequests/${key}`).get()).get('status'),'expired');}
  for(const key of ['today','future','legacy-000']) assert.equal((await db.doc(`ateliers/${a}/quotes/${key}`).get()).get('status'),'sent');
  assert.equal((await db.doc('foreign/namespace/quotes/foreign').get()).get('status'),'sent');
  assert.equal((await db.collection('auditLogs').where('action','==','quote.expired').get()).size,2);
  assert.equal((await mf.dispatchFetch('http://localhost/expireQuotes')).status,404);
},{timeout:120000});


test('Approval/order race after actual RTDB PUT leaves pending bytes inaccessible; retry reconciles without overwrite',async()=>{
  const key=randomUUID(), fileId=hash(JSON.stringify([a,'order-a',people.ownerA.uid,key]));
  mutateAfterObjectPut=()=>db.doc(`ateliers/${a}/orders/order-a`).update({status:'completed'});
  const failed=await fileUpload(pdf,key);assert.equal(failed.status,403,JSON.stringify(failed));
  assert.equal((await db.doc(`ateliers/${a}/orders/order-a/sparkFiles/${fileId}`).get()).get('status'),'pending');
  assert.ok((await rtdb(`spark/objects/${a}/${fileId}`)).base64);
  assert.equal((await fileGet(fileId)).status,403);
  await db.doc(`ateliers/${a}/orders/order-a`).update({status:'confirmed'});
  await db.doc(`ateliers/${a}/orders/order-a/sparkFiles/${fileId}`).update({leaseUntil:new Date(0)});
  const resumed=await fileUpload(pdf,key);assert.equal(resumed.status,200,JSON.stringify(resumed));
});
test('Immutable collision after interruption refuses different existing RTDB bytes',async()=>{
  const key=randomUUID(), fileId=hash(JSON.stringify([a,'order-a',people.ownerA.uid,key]));
  await rtdb(`spark/objects/${a}/${fileId}`,'PUT',{base64:Buffer.from('%PDF-other').toString('base64'),sha256:hash(Buffer.from('%PDF-other')),contentType:'application/pdf'});
  const r=await fileUpload(pdf,key);assert.equal(r.error.status,'ALREADY_EXISTS');
  assert.equal((await fileGet(fileId)).status,403);
});
test('Synthetic RTDB snapshot round-trip preserves private bytes, accounting and checksums; tampering is refused',async()=>{
  const before=await rtdb('spark'),json=JSON.stringify(before),digest=hash(Buffer.from(json));
  // Separate synthetic destination, no overwrite/deletion of the source.
  await rtdb('spark-restore-'+nonce,'PUT',JSON.parse(json));
  const restored=await rtdb('spark-restore-'+nonce);
  assert.deepEqual(restored,before);assert.equal(hash(Buffer.from(JSON.stringify(restored))),digest);
  assert.equal(hash(Buffer.from(restored.objects[a][uploaded.data.fileId].base64,'base64')),hash(pdf));
  assert.deepEqual(restored.quota,before.quota);
  const unauthorized=await fetch(`${env.DATABASE_ORIGIN}/spark-restore-${nonce}.json?ns=demo-cosmaker-default-rtdb`);assert.equal(unauthorized.status,401);
  assert.notEqual(hash(Buffer.from(json+' ')),digest);
});
test('RTDB single-string 20 MiB incompatibility and local workerd resource measurements are recorded without claiming Free CPU acceptance',async()=>{
  const large=Buffer.alloc(20*1024*1024,65).toString('base64');
  const direct=await fetch(`${env.DATABASE_ORIGIN}/oversize-probe.json?ns=demo-cosmaker-default-rtdb`,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({base64:large})});
  assert.equal(direct.status,400);assert.match(await direct.text(),/Invalid data|too large|limit/i);assert.equal(await rtdb('oversize-probe'),null);
  const candidates=await readdir('/proc');let pid;
  for(const candidate of candidates.filter(v=>/^\d+$/.test(v)))try{const status=await readFile('/proc/'+candidate+'/status','utf8');if(status.includes('Name:\tworkerd')&&status.includes('PPid:\t'+process.pid+'\n'))pid=candidate;}catch{}
  assert.ok(pid,'owned workerd process required for Linux measurement');
  const stat=async()=>{const raw=await readFile('/proc/'+pid+'/stat','utf8'),parts=raw.slice(raw.lastIndexOf(')')+2).split(' ');return {ticks:Number(parts[11])+Number(parts[12]),rss:Number(parts[21])*4096};};
  const measurements=[];
  for(const size of [64*1024,1024*1024,6*1024*1024]){
    const bytes=Buffer.alloc(size,65);bytes.write('%PDF-');
    const before=await stat(),start=performance.now();
    const result=await fileUpload(bytes);assert.equal(result.status,200,JSON.stringify(result));
    const middle=await stat(),uploadWallMs=performance.now()-start;
    const begin=performance.now(),response=await fileGet(result.data.fileId,'ownerA');assert.equal(response.status,200);assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(bytes));
    const end=await stat();measurements.push({bytes:size,uploadWallMs,downloadWallMs:performance.now()-begin,uploadSubrequests:result.subrequests,downloadSubrequests:Number(response.headers.get('X-Spark-Subrequests')),uploadProcessCpuMs:(middle.ticks-before.ticks)*10,downloadProcessCpuMs:(end.ticks-middle.ticks)*10,rssBytes:end.rss});
  }
  const result={kind:'LOCAL_PROCESS_CPU_PROXY_NOT_EDGE_BILLABLE_CPU',tickMs:10,workerFreeCpuMs:10,measurements};
  await mkdir('.local/spark',{recursive:true});await writeFile('.local/spark/resources.json',JSON.stringify(result,null,2));console.log('SPARK_RESOURCES',JSON.stringify(result));
}, {timeout:120000});


test('Actual interrupted HTTP upload publishes no metadata, object or quota reservation',async()=>{
  const key=randomUUID(),fileId=hash(JSON.stringify([a,'order-a',people.ownerA.uid,key]));
  const before=await rtdb('spark/quota');
  const endpoint=new URL(`files/${a}/order-a`,await mf.ready);
  const abort=new AbortController();
  const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(Buffer.from('%PDF-1.7\npartial')));}});
  const request=fetch(endpoint,{method:'POST',duplex:'half',body,headers:{Authorization:'Bearer '+people.ownerA.token,'Content-Type':'application/pdf','x-request-id':key,'x-content-sha256':hash(pdf)},signal:abort.signal});
  setTimeout(()=>abort.abort(),150);
  await assert.rejects(request,/abort|fetch failed/i);
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal((await db.doc(`ateliers/${a}/orders/order-a/sparkFiles/${fileId}`).get()).exists,false);
  assert.equal(await rtdb(`spark/objects/${a}/${fileId}`),null);assert.deepEqual(await rtdb('spark/quota'),before);
});
test('Reused contact e-mail cannot recover a private order after original Auth UID deletion',async()=>{
  const email='uid-reuse-'+nonce+'@cosmaker.test',password='Synthetic!Password123';
  const first=await auth.createUser({email,password,emailVerified:true});
  const orderRef=db.doc(`ateliers/${a}/orders/order-a`);
  await orderRef.update({clientUserId:first.uid});
  await db.doc(`users/${first.uid}`).set({active:true,accountType:'client'});
  await auth.deleteUser(first.uid);
  const replacement=await auth.createUser({email,password,emailVerified:true});assert.notEqual(first.uid,replacement.uid);
  await db.doc(`users/${replacement.uid}`).set({active:true,accountType:'client'});
  const client=initializeApp({apiKey:'emulator-only-key',projectId,authDomain:projectId+'.firebaseapp.com',appId:'emulator-only-app'},'uid-reuse-'+nonce);clients.push(client);
  const ca=getAuth(client);connectAuthEmulator(ca,env.AUTH_ORIGIN,{disableWarnings:true});
  const user=await signInWithEmailAndPassword(ca,email,password);
  people.reused={uid:replacement.uid,token:await user.user.getIdToken()};
  assert.equal((await fileGet(uploaded.data.fileId,'reused')).status,403);
  await orderRef.update({clientUserId:people.clientA.uid});
});
