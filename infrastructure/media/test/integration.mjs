import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {proofDatabase} from '../src/proof-db.mjs';
import {MediaCoordinator} from '../src/coordinator.mjs';
import {RtdbChunkProvider,SupabaseStorageAdapter,PART_BYTES,hashBytes,MAX_FILE_BYTES} from '../src/storage.mjs';
import {storageApiDouble,tusUpload} from './storage-api-double.mjs';
import {pdfBytes,png,jpeg,webp} from './fixtures.mjs';
import {DAY,MiB,POLICY_VERSION,retentionFor} from '../src/policy.mjs';
import {backupMedia,restoreMedia,reconcileRecovery} from '../src/recovery.mjs';
import {retentionSweep} from '../src/retention-job.mjs';
import {startBroker} from '../src/broker.mjs';
import {closeActivityWindows} from '../src/activity.mjs';
const req=createRequire(new URL('../../../functions/package.json',import.meta.url));
const {initializeApp,deleteApp}=req('firebase-admin/app'),{getAuth}=req('firebase-admin/auth'),{getFirestore}=req('firebase-admin/firestore');
for(const key of['FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','FIREBASE_DATABASE_EMULATOR_HOST'])if(!/^127\.0\.0\.1:\d+$/.test(process.env[key]||''))throw Error('Loopback Emulator required');
if(process.env.GCLOUD_PROJECT!=='demo-cosmaker')throw Error('demo-cosmaker required');
const env={MODE:'emulator',PROJECT_ID:'demo-cosmaker',AUTH_ORIGIN:'http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST,FIRESTORE_ORIGIN:'http://'+process.env.FIRESTORE_EMULATOR_HOST,DATABASE_ORIGIN:'http://'+process.env.FIREBASE_DATABASE_EMULATOR_HOST};
const app=initializeApp({projectId:'demo-cosmaker'},'media-v7'),auth=getAuth(app),admin=getFirestore(app),db=proofDatabase(env);
let tick=Date.now(),double;const who={},coordinators={},providers={};const tenantA='media-proof-a',tenantB='media-proof-b';
let full;const measurements=[];
const input=(bytes,extra={})=>({requestId:randomUUID(),orderId:'order-a',size:bytes.length,sha256:hashBytes(bytes),mime:'application/pdf',shared:false,...extra});
async function upload(core,bytes,extra={}){const value=input(bytes,extra),created=await core.create(who.a,value);if(created.upload){await tusUpload({...created.upload,mime:value.mime},bytes);}else for(let n=0;n<Math.ceil(bytes.length/PART_BYTES);n++)await core.putPart(who.a,tenantA,created.asset.id,created.asset.leaseFence,n,bytes.subarray(n*PART_BYTES,(n+1)*PART_BYTES));const ready=await core.complete(who.a,tenantA,created.asset.id,created.asset.leaseFence);return{...ready,request:value};}
before(async()=>{
 for(const [name,tenant,account]of[['a',tenantA,'atelier_member'],['b',tenantB,'atelier_member'],['client',null,'client']]){const u=await auth.createUser({email:name+'-media-v7@cosmaker.test',password:'Synthetic!Password123',emailVerified:true});who[name]={uid:u.uid};await admin.doc('users/'+u.uid).set({active:true,accountType:account,...(tenant?{atelierId:tenant}:{})});if(tenant){await admin.doc('ateliers/'+tenant).set({active:true});await admin.doc(`ateliers/${tenant}/members/${u.uid}`).set({active:true,role:'owner',permissions:[]});}}
 await admin.doc(`ateliers/${tenantA}/orders/order-a`).set({atelierId:tenantA,status:'confirmed',clientUserId:who.client.uid});await admin.doc(`ateliers/${tenantB}/orders/order-a`).set({atelierId:tenantB,status:'confirmed',clientUserId:'other-client'});
 double=await storageApiDouble({now:()=>tick});providers.rtdb=new RtdbChunkProvider(env.DATABASE_ORIGIN);providers.supabase=new SupabaseStorageAdapter(double.origin,double.credential);
 for(const[name,provider]of Object.entries(providers))coordinators[name]=new MediaCoordinator({db,provider,enabled:true,now:()=>tick});
 full=pdfBytes(MAX_FILE_BYTES);assert.equal(full.length,MAX_FILE_BYTES);
}, {timeout:60000});
after(async()=>{await double?.close();await deleteApp(app);});
test('RTDB actual Emulator: exactly 20 MiB upload, full SHA-256, private read, replay and tenant A/B',async()=>{
 const core=coordinators.rtdb,start=performance.now(),before=db.requests(),result=await upload(core,full,{shared:true});
 assert.equal(result.asset.size,MAX_FILE_BYTES);assert.equal(result.verificationRequests,41);
 const read=await core.read(who.client,tenantA,result.asset.id);assert.equal(read.bytes.length,MAX_FILE_BYTES);assert.equal(hashBytes(read.bytes),hashBytes(full));
 await assert.rejects(core.read(who.b,tenantA,result.asset.id),{code:'permission-denied'});
 assert.equal((await core.complete(who.a,tenantA,result.asset.id,1)).alreadyApplied,true);
 await assert.rejects(core.create(who.a,{...result.request,size:MAX_FILE_BYTES-1}),{code:'failed-precondition'});
 const audits=await admin.collection('auditLogs').where('entityId','==',result.asset.id).where('action','==','media.ready').get();assert.equal(audits.size,1);
 measurements.push({provider:'RTDB_EMULATOR_REAL',bytes:MAX_FILE_BYTES,wallMs:performance.now()-start,firestoreRequests:db.requests()-before,verificationProviderRequests:result.verificationRequests,workerFree:'BLOCKED_NOT_EDGE_ACCEPTANCE'});
},{timeout:180000});
test('Supabase protocol double: 20 MiB direct TUS, 6 MiB interruption/resume, immutable ready and exact private export',async()=>{
 const core=coordinators.supabase,value=input(full,{shared:true}),created=await core.create(who.a,value);
 const partial=await tusUpload({...created.upload,mime:value.mime},full,{interruptAfterChunks:1});assert.equal(partial.offset,6*MiB);
 await assert.rejects(core.read(who.client,tenantA,created.asset.id),{code:'permission-denied'});
 await tusUpload({...created.upload,mime:value.mime},full,{resource:partial.resource});
 const ready=await core.complete(who.a,tenantA,created.asset.id,1),bytes=(await core.read(who.client,tenantA,created.asset.id)).bytes;assert.equal(hashBytes(bytes),hashBytes(full));
 assert.equal(ready.asset.state,'READY');assert.equal(ready.verificationRequests,41);
 const dup=await fetch(created.upload.tusEndpoint,{method:'POST',headers:{'x-signature':created.upload.providerToken,'Upload-Length':String(full.length),'Upload-Metadata':Object.entries({bucketName:created.upload.bucket,objectName:created.upload.key,contentType:'application/pdf'}).map(([k,v])=>k+' '+Buffer.from(v).toString('base64')).join(',')}});assert.equal(dup.status,400);
 measurements.push({provider:'SUPABASE_PROTOCOL_DOUBLE_NOT_PROVIDER_ACCEPTANCE',bytes:MAX_FILE_BYTES,tusNativeSha256:false,realRls:false,realBilling:false});
},{timeout:180000});
test('binary boundary matrix 0/6 MiB/19.99 MiB/20 MiB/20 MiB+1 and original formats; SVG/GIF refused',async()=>{
 const core=coordinators.rtdb;
 for(const size of[0,MAX_FILE_BYTES+1])await assert.rejects(core.create(who.a,input(Buffer.alloc(0),{size})),{code:'invalid-argument'});
 for(const size of[6*MiB,Math.floor(19.99*MiB)]){const bytes=pdfBytes(size),result=await upload(core,bytes);assert.equal(hashBytes((await core.read(who.a,tenantA,result.asset.id)).bytes),hashBytes(bytes));}
 for(const[mime,bytes]of[['image/png',png],['image/jpeg',jpeg],['image/webp',webp]]){const result=await upload(core,bytes,{mime});assert.equal(result.asset.mediaClass,'TEMP_WORKFLOW');}
 for(const mime of['image/svg+xml','image/gif','application/zip'])await assert.rejects(core.create(who.a,input(png,{mime})),{code:'invalid-argument'});
},{timeout:180000});
test('hash or MIME tampering leaves pending private bytes; lease expiry/fencing prevents stale resume',async()=>{
 const core=coordinators.rtdb,bytes=pdfBytes(600),c=await core.create(who.a,input(bytes,{sha256:'0'.repeat(64)}));await core.putPart(who.a,tenantA,c.asset.id,1,0,bytes);
 await assert.rejects(core.complete(who.a,tenantA,c.asset.id,1),/integrity/);assert.equal((await admin.doc(core.assetPath(tenantA,c.asset.id)).get()).get('state'),'PENDING');
 tick+=300001;await assert.rejects(core.putPart(who.a,tenantA,c.asset.id,1,0,bytes),{code:'failed-precondition'});const fence=await core.renew(who.a,tenantA,c.asset.id);assert.equal(fence,2);await assert.rejects(core.putPart(who.a,tenantA,c.asset.id,1,0,bytes),{code:'failed-precondition'});
 const resumable=await core.create(who.a,input(png,{mime:'image/png'}));await core.putPart(who.a,tenantA,resumable.asset.id,1,0,png);
 await admin.doc(`ateliers/${tenantA}/orders/order-a`).update({updatedAt:new Date(tick)});await assert.rejects(core.complete(who.a,tenantA,resumable.asset.id,1),{code:'failed-precondition'});
 const refreshedFence=await core.renew(who.a,tenantA,resumable.asset.id);assert.equal((await core.complete(who.a,tenantA,resumable.asset.id,refreshedFence)).asset.state,'READY');
 const bad=await core.create(who.a,input(Buffer.from('not a png'),{mime:'image/png'}));await core.putPart(who.a,tenantA,bad.asset.id,1,0,Buffer.from('not a png'));await assert.rejects(core.complete(who.a,tenantA,bad.asset.id,1),/integrity/);
});
test('concurrent reservations serialize capacity and failed attempts never discard existing files',async()=>{
 const core=new MediaCoordinator({db,provider:providers.rtdb,enabled:true,now:()=>tick,capacity:1});
 await assert.rejects(core.create(who.a,input(pdfBytes(600))),{code:'resource-exhausted'});
 const before=(await admin.doc(core.meterPath()).get()).data();assert.ok(before.active>MAX_FILE_BYTES);
 const key=randomUUID(),bytes=pdfBytes(600),requests=await Promise.all([coordinators.rtdb.create(who.a,input(bytes,{requestId:key})),coordinators.rtdb.create(who.a,input(bytes,{requestId:key}))]);assert.equal(requests[0].asset.id,requests[1].asset.id);
 const audits=await admin.collection('auditLogs').where('entityId','==',requests[0].asset.id).where('action','==','media.reserved').get();assert.equal(audits.size,1);
});
test('direct provider raw access is denied; signed URL stale window is an explicit blocker, not claimed immediate revocation',async()=>{
 const core=coordinators.supabase,bytes=pdfBytes(600),r=await upload(core,bytes,{shared:true});
 const raw=await fetch(double.origin+'/storage/v1/object/public/cosmaker-media-proof/'+r.asset.key);assert.equal(raw.status,403);
 const direct=await fetch(env.DATABASE_ORIGIN+'/mediaV7.json?ns=demo-cosmaker-default-rtdb');assert.equal(direct.status,401);
 const url=await providers.supabase.signedRead(r.asset.key,30),signed=double.origin+'/storage/v1'+url.signedURL;
 await core.revoke(who.a,tenantA,r.asset.id);await assert.rejects(core.read(who.client,tenantA,r.asset.id),{code:'permission-denied'});
 assert.equal((await fetch(signed)).status,200); // Faithful bearer-token limitation, release gate BLOCKED.
 tick+=31000;assert.equal((await fetch(signed)).status,403);
});
test('persisted policy, notices, dry-run, hold and stale revision protect against deletion after extension',async()=>{
 const core=coordinators.rtdb,r=await upload(core,png,{mime:'image/png'}),path=core.assetPath(tenantA,r.asset.id);
 await admin.doc(`ateliers/${tenantA}/orders/order-a`).update({status:'completed',completedAt:new Date(tick-200*DAY)});
 const decision=await core.evaluateRetention(tenantA,r.asset.id,'HIGH');assert.equal(decision.eligible,false);assert.equal(decision.reason,'WITHIN_GRACE');
 const current=(await admin.doc(path).get()).data();assert.equal(current.retention.policyVersion,POLICY_VERSION);assert.ok(current.notices.warning.recordedAt);assert.ok(current.notices.due.recordedAt);
 tick+=8*DAY;const plan=await core.planDeletion(tenantA,r.asset.id);assert.equal(plan.eligible,true);assert.deepEqual(await core.applySyntheticDeletion(plan),{mode:'DRY_RUN',wouldDelete:true});
 assert.equal((await core.read(who.a,tenantA,r.asset.id)).bytes.length,png.length);
 await admin.doc(path).update({legalHold:true,revision:current.revision+1});await assert.rejects(core.applySyntheticDeletion(plan,{mode:'SYNTHETIC_APPLY'}),{code:'aborted'});
 await admin.doc(path).update({legalHold:false,revision:current.revision+2});const newPlan=await core.planDeletion(tenantA,r.asset.id);assert.equal((await core.applySyntheticDeletion(newPlan,{mode:'SYNTHETIC_APPLY'})).deleted,true);
 assert.equal((await admin.doc(path).get()).get('state'),'TOMBSTONED');assert.equal((await admin.doc('mediaTombstonesV7/'+r.asset.id).get()).exists,true);
 await admin.doc(`ateliers/${tenantA}/orders/order-a`).update({status:'confirmed'});
},{timeout:60000});
test('save resource observations without promoting real provider/cost/Free/production acceptance',async()=>{await mkdir('.local/media-v7',{recursive:true});await writeFile('.local/media-v7/provider-observations.json',JSON.stringify({measurements,cutover:false,commercial:'NOT_READY'},null,2));console.log('GVII_PROVIDER_OBSERVATIONS',JSON.stringify(measurements));});
test('20 MiB bytes+metadata backup, crash/resume restore, exact read and positive absence reconciliation',async()=>{
 const core=coordinators.rtdb,r=await upload(core,full,{shared:true}),snapshot=await backupMedia(core,who.a,tenantA,r.asset.id);
 assert.equal((await restoreMedia(core,who.a,snapshot)).mode,'DRY_RUN');
 await assert.rejects(restoreMedia(core,who.b,snapshot),{code:'permission-denied'});
 await assert.rejects(restoreMedia(core,who.a,{...snapshot,base64:snapshot.base64+'AAAA'}),/checksum/);
 await providers.rtdb.remove(r.asset.key,{mode:'SYNTHETIC_APPLY',project:'demo-cosmaker',fixture:true});
 const original=providers.rtdb.putPart.bind(providers.rtdb);let interrupted=false;
 providers.rtdb.putPart=async(...args)=>{if(args[1]===3&&!interrupted){interrupted=true;throw Error('Synthetic interruption');}return original(...args);};
 await assert.rejects(restoreMedia(core,who.a,snapshot,{mode:'SYNTHETIC_APPLY'}),/interruption/);providers.rtdb.putPart=original;
 assert.equal((await admin.doc(core.assetPath(tenantA,r.asset.id)).get()).get('state'),'RESTORING');
 const restored=await restoreMedia(core,who.a,snapshot,{mode:'SYNTHETIC_APPLY'});assert.equal(restored.bytes,MAX_FILE_BYTES);
 const read=await core.read(who.client,tenantA,r.asset.id);assert.equal(hashBytes(read.bytes),snapshot.sha256);assert.equal(read.asset.createdAt.toISOString(),snapshot.metadata.createdAt);assert.equal(read.asset.mediaClass,snapshot.metadata.mediaClass);
 const operation=hashBytes(snapshot.snapshotSha256);assert.equal((await reconcileRecovery(core,operation)).released,true);assert.equal((await reconcileRecovery(core,operation)).alreadyApplied,true);
 assert.equal((await restoreMedia(core,who.a,snapshot,{mode:'SYNTHETIC_APPLY'})).alreadyApplied,true);
 await admin.doc('mediaTombstonesV7/'+r.asset.id).set({atelierId:tenantA,key:r.asset.key});await assert.rejects(restoreMedia(core,who.a,snapshot),/Tombstone/);await assert.rejects(core.read(who.a,tenantA,r.asset.id),{code:'permission-denied'});
},{timeout:180000});
test('all required recipients, retry idempotence, failure recovery and authorized extension fence',async()=>{
 const core=coordinators.rtdb,r=await upload(core,png,{mime:'image/png',shared:true}),path=core.assetPath(tenantA,r.asset.id);
 await admin.doc(`ateliers/${tenantA}/orders/order-a`).update({status:'completed',completedAt:new Date(tick-200*DAY)});
 await admin.doc('users/'+who.client.uid).update({active:false});
 await core.evaluateRetention(tenantA,r.asset.id,'HIGH');assert.equal((await admin.doc(path).get()).get('notices.due.failed'),true);assert.equal((await admin.doc(core.meterPath()).get()).get('noticeFailure'),true);
 await admin.doc(`ateliers/${tenantA}/orders/order-a`).update({status:'confirmed'});
 await assert.rejects(core.create(who.a,input(png,{mime:'image/png'})),{code:'resource-exhausted'});
 await admin.doc('users/'+who.client.uid).update({active:true});await admin.doc(`ateliers/${tenantA}/orders/order-a`).update({status:'completed'});
 await core.evaluateRetention(tenantA,r.asset.id,'HIGH');const before=(await admin.doc(path).get()).data();assert.equal(before.notices.due.recipients.length,2);assert.equal((await admin.doc(core.meterPath()).get()).get('noticeFailure'),false);
 await core.evaluateRetention(tenantA,r.asset.id,'HIGH');assert.equal((await admin.doc(path).get()).get('revision'),before.revision);
 tick+=15*DAY;const plan=await core.planDeletion(tenantA,r.asset.id);assert.equal(plan.eligible,true);
 await core.protect(who.a,tenantA,r.asset.id,{extendUntil:new Date(tick+30*DAY).toISOString()});await assert.rejects(core.applySyntheticDeletion(plan,{mode:'SYNTHETIC_APPLY'}),{code:'aborted'});
 await assert.rejects(core.protect(who.b,tenantA,r.asset.id,{legalHold:true}),{code:'permission-denied'});
 await admin.doc(`ateliers/${tenantA}/orders/order-a`).update({status:'confirmed'});
});
test('deletion crash resumes exact API removal once and decrements tenant/global meters once',async()=>{
 const core=coordinators.rtdb,r=await upload(core,png,{mime:'image/png'}),path=core.assetPath(tenantA,r.asset.id);
 await admin.doc(`ateliers/${tenantA}/orders/order-a`).update({status:'completed',completedAt:new Date(tick-200*DAY)});await core.evaluateRetention(tenantA,r.asset.id,'HIGH');tick+=15*DAY;
 const plan=await core.planDeletion(tenantA,r.asset.id),before=(await admin.doc(core.meterPath()).get()).data(),original=providers.rtdb.remove.bind(providers.rtdb);let fail=true;
 providers.rtdb.remove=async(...args)=>{await original(...args);if(fail){fail=false;throw Error('Crash after provider API');}};
 await assert.rejects(core.applySyntheticDeletion(plan,{mode:'SYNTHETIC_APPLY'}),/Crash/);assert.equal((await admin.doc(path).get()).get('state'),'DELETING');
 await assert.rejects(core.protect(who.a,tenantA,r.asset.id,{legalHold:true}),{code:'failed-precondition'});
 assert.equal((await core.applySyntheticDeletion(plan,{mode:'SYNTHETIC_APPLY'})).deleted,true);providers.rtdb.remove=original;
 assert.equal((await core.applySyntheticDeletion(plan,{mode:'SYNTHETIC_APPLY'})).alreadyApplied,true);const after=(await admin.doc(core.meterPath()).get()).data();assert.equal(before.active-after.active,r.asset.activeBytes);assert.equal(before.tenants[tenantA]-after.tenants[tenantA],r.asset.activeBytes);
 await admin.doc(`ateliers/${tenantA}/orders/order-a`).update({status:'confirmed'});
});
test('bounded UTC retention sweep passes 110 invalid records, retains cursor across midnight and lease protects concurrency',async()=>{
 const core=coordinators.rtdb;const batch=admin.batch();for(let i=0;i<110;i++)batch.set(admin.doc('ateliers/aaa-invalid/mediaAssetsV7/bad-'+String(i).padStart(3,'0')),{synthetic:false});await batch.commit();
 let invalid=0,evaluated=0;for(let page=0;page<12;page++){const result=await retentionSweep(core);invalid+=result.invalid;evaluated+=result.evaluated;if(page===1)tick+=DAY;}
 assert.ok(invalid>=110);assert.ok(evaluated>0);
 await admin.doc('platformRuntime/mediaRetentionV7').set({leaseUntil:new Date(tick+60000),leaseId:'other'});assert.equal((await retentionSweep(core)).leased,true);
 await assert.rejects(retentionSweep(core,{scheduledTime:tick+120000}),/UTC/);
});
test('global pause and monthly transfer admission preserve bytes; membership revocation closes reads',async()=>{
 const core=coordinators.rtdb,r=await upload(core,png,{mime:'image/png'});
 await admin.doc('platformRuntime/mediaGovernanceV7').set({uploadsPaused:true});await assert.rejects(core.create(who.a,input(png,{mime:'image/png'})),{code:'resource-exhausted'});
 assert.equal((await core.read(who.a,tenantA,r.asset.id)).bytes.length,png.length);await admin.doc('platformRuntime/mediaGovernanceV7').set({uploadsPaused:false});
 const limited=new MediaCoordinator({db,provider:providers.rtdb,enabled:true,now:()=>tick,monthlyEgress:1});await assert.rejects(limited.read(who.a,tenantA,r.asset.id),{code:'resource-exhausted'});
 await admin.doc(`ateliers/${tenantA}/members/${who.a.uid}`).update({active:false});await assert.rejects(core.read(who.a,tenantA,r.asset.id),{code:'permission-denied'});await admin.doc(`ateliers/${tenantA}/members/${who.a.uid}`).update({active:true});
});
test('HTTP broker checks Auth Emulator tokens, disabled/revoked users and global RBAC; workerd scheduled reaches private dry-run only',async()=>{
 const core=coordinators.rtdb,secret=randomUUID()+randomUUID(),broker=await startBroker({core,env:{...env,COSMAKER_MEDIA_PROOF:'true'},cronSecret:secret});
 const sparkReq=createRequire(new URL('../../spark/package.json',import.meta.url)),{Miniflare,convertV4MiniflareOptions}=sparkReq('miniflare');let runtime;
 const login=async email=>{const r=await fetch(env.AUTH_ORIGIN+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'Synthetic!Password123',returnSecureToken:true})});assert.equal(r.status,200);return(await r.json()).idToken;};
 try{
  const token=await login('a-media-v7@cosmaker.test');
  assert.equal((await fetch(broker.origin+'/governance')).status,401);
  assert.equal((await fetch(broker.origin+'/governance',{headers:{Authorization:'Bearer invalid'}})).status,401);
  const parts=token.split('.'),claims=JSON.parse(Buffer.from(parts[1],'base64url'));claims.exp=1;const expired=parts[0]+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.';
  assert.equal((await fetch(broker.origin+'/governance',{headers:{Authorization:'Bearer '+expired}})).status,401);
  assert.equal((await fetch(broker.origin+'/governance',{headers:{Authorization:'Bearer '+token}})).status,403);
  await auth.updateUser(who.a.uid,{disabled:true});assert.equal((await fetch(broker.origin+'/governance',{headers:{Authorization:'Bearer '+token}})).status,401);await auth.updateUser(who.a.uid,{disabled:false});
  await auth.revokeRefreshTokens(who.a.uid);const staleClaims=JSON.parse(Buffer.from(parts[1],'base64url'));staleClaims.auth_time-=3600;const stale=parts[0]+'.'+Buffer.from(JSON.stringify(staleClaims)).toString('base64url')+'.';
  assert.equal((await fetch(broker.origin+'/governance',{headers:{Authorization:'Bearer '+stale}})).status,401);
  const owner=await auth.createUser({email:'platform-media-v7@cosmaker.test',password:'Synthetic!Password123',emailVerified:true});await admin.doc('users/'+owner.uid).set({active:true,accountType:'platform_admin'});const ownerToken=await login('platform-media-v7@cosmaker.test');
  const headers={Authorization:'Bearer '+ownerToken,'Content-Type':'application/json'};
  assert.equal((await fetch(broker.origin+'/governance',{method:'POST',headers,body:JSON.stringify({uploadsPaused:true,ttl:0})})).status,400);
  assert.equal((await fetch(broker.origin+'/governance',{method:'POST',headers,body:JSON.stringify({uploadsPaused:true})})).status,200);
  const view=await(await fetch(broker.origin+'/governance',{headers})).json();assert.equal(view.data.settings.uploadsPaused,true);assert.equal(view.data.mode,'DRY_RUN');
  assert.equal((await fetch(broker.origin+'/internal/retention-dry-run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scheduledTime:tick})})).status,403);
  await admin.doc('platformRuntime/mediaRetentionV7').set({leaseUntil:new Date(0),cursor:null});
  runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:await readFile(new URL('../src/cron-worker.mjs',import.meta.url),'utf8'),compatibilityDate:'2026-10-25',bindings:{MODE:'emulator',PROJECT_ID:'demo-cosmaker',MEDIA_BROKER_ORIGIN:broker.origin,MEDIA_CRON_SECRET:secret}}));
  await runtime.ready;const worker=await runtime.getWorker();const result=await worker.scheduled({scheduledTime:tick,cron:'0 * * * *'});assert.equal(result.outcome,'ok');
  assert.equal((await admin.doc('platformRuntime/mediaRetentionV7').get()).get('mode'),'DRY_RUN');
  assert.equal((await runtime.dispatchFetch('http://localhost/cron')).status,404);
 }finally{await runtime?.dispose();await broker.close();}
},{timeout:60000});
test('lifecycle admission: closed activity windows persist real facts and 21 tenants share aggregate pending capacity safely',async()=>{
 const core=coordinators.rtdb,start=tick-61*DAY,activityPath='ateliers/activity-fixture/mediaActivityV7/current';
 await admin.doc(activityPath).set({tier:'HIGH',belowWindows:0,lastClosedEnd:null,windowStartAt:new Date(start).toISOString(),events:[],policyVersion:POLICY_VERSION});
 await admin.doc('ateliers/activity-fixture/mediaUploadFactsV7/one').set({atelierId:'activity-fixture',size:1,recordedAt:new Date(start+DAY)});
 assert.equal((await closeActivityWindows(core,'activity-fixture')).tier,'NONE');assert.equal((await closeActivityWindows(core,'never-active')),null);
 assert.equal((await admin.doc('ateliers/never-active/mediaActivityV7/current').get()).exists,false);
 const provider=new RtdbChunkProvider(env.DATABASE_ORIGIN);provider.name='rtdb-chunked-capacity-local';const capacityCore=new MediaCoordinator({db,provider,enabled:true,now:()=>tick});
 await admin.doc('platformRuntime/mediaGovernanceV7').set({uploadsPaused:false});
 const batch=admin.batch();for(let n=0;n<21;n++){const tenant='capacity-'+n,uid='capacity-uid-'+n;batch.set(admin.doc('users/'+uid),{active:true,accountType:'atelier_member',atelierId:tenant});batch.set(admin.doc('ateliers/'+tenant),{active:true});batch.set(admin.doc(`ateliers/${tenant}/members/${uid}`),{active:true,role:'owner'});batch.set(admin.doc(`ateliers/${tenant}/orders/order-a`),{atelierId:tenant,status:'confirmed'});}await batch.commit();
 const outcomes=[];for(let n=0;n<21;n++)outcomes.push(...await Promise.allSettled([0,1].map(()=>capacityCore.create({uid:'capacity-uid-'+n},input(full)))));
 const accepted=outcomes.filter(o=>o.status==='fulfilled'),denied=outcomes.filter(o=>o.status==='rejected');assert.ok(accepted.length>0&&denied.length>0);assert.ok(denied.every(o=>o.reason.code==='resource-exhausted'));
 const meter=(await admin.doc(capacityCore.meterPath()).get()).data();assert.equal(meter.active,0);assert.ok(meter.pending<1_000_000_000*.8);assert.equal(Object.values(meter.tenants).reduce((a,b)=>a+b,0),meter.pending);
 console.log('GVII_21_TENANTS',JSON.stringify({tenants:21,attempts:42,accepted:accepted.length,denied:denied.length,pending:meter.pending,objectsDeleted:0,monthlyTelemetry:'NOT_PROVIDER_BILLING'}));
},{timeout:60000});
