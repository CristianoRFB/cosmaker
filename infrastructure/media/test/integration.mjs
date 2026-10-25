import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {proofDatabase} from '../src/proof-db.mjs';
import {MediaCoordinator} from '../src/coordinator.mjs';
import {RtdbChunkProvider,SupabaseStorageAdapter,PART_BYTES,hashBytes,MAX_FILE_BYTES} from '../src/storage.mjs';
import {storageApiDouble,tusUpload} from './storage-api-double.mjs';
import {pdfBytes,png,jpeg,webp} from './fixtures.mjs';
import {DAY,MiB,POLICY_VERSION,retentionFor} from '../src/policy.mjs';
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
