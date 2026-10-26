import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {pdfBytes} from '../../media/test/fixtures.mjs';
import {profileInvocation} from './profiler.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),require=createRequire(new URL('../../spark/package.json',import.meta.url));
const {build}=require('esbuild'),{Miniflare,convertV4MiniflareOptions}=require('miniflare');
const adminRequire=createRequire(new URL('../../../functions/package.json',import.meta.url));
const {initializeApp,deleteApp}=adminRequire('firebase-admin/app'),{getAuth}=adminRequire('firebase-admin/auth'),{getFirestore}=adminRequire('firebase-admin/firestore');
if(process.env.GCLOUD_PROJECT!=='demo-cosmaker'||!['FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST'].every(k=>/^127\.0\.0\.1:\d+$/.test(process.env[k]||'')))throw Error('Only literal loopback demo emulators');
const app=initializeApp({projectId:'demo-cosmaker'},'viii-runtime'),auth=getAuth(app),db=getFirestore(app);
const tenant='viii-a',id=randomBytes(32).toString('hex'),bytes=pdfBytes(20*1024*1024),sha=createHash('sha256').update(bytes).digest('hex'),secret=randomBytes(32).toString('hex');
const assetPath=`ateliers/${tenant}/mediaAssetsV7/${id}`,users={},tokens={},observations=[];
let server,strict,diagnostic,behavior='normal',served=0;
const env={MODE:'emulator',PROJECT_ID:'demo-cosmaker',AUTH_ORIGIN:'http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST,FIRESTORE_ORIGIN:'http://'+process.env.FIRESTORE_EMULATOR_HOST,DATABASE_ORIGIN:'http://127.0.0.1:19000'};
async function request(runtime,operation='verify',token=tokens.a){return runtime.dispatchFetch(`http://localhost/${operation}/${id}`,{headers:token?{Authorization:'Bearer '+token}:{}});}
before(async()=>{
 for(const[name,t,kind]of[['a',tenant,'atelier_member'],['b','viii-b','atelier_member'],['client',null,'client']]){
  const u=await auth.createUser({email:'viii-'+name+'@cosmaker.test',password:'Synthetic!Password123',emailVerified:true});users[name]=u;
  await db.doc('users/'+u.uid).set({active:true,accountType:kind,...(t?{atelierId:t}:{})});
  if(t){await db.doc('ateliers/'+t).set({active:true});await db.doc(`ateliers/${t}/members/${u.uid}`).set({active:true,role:'owner'});}
  const r=await fetch(env.AUTH_ORIGIN+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:u.email,password:'Synthetic!Password123',returnSecureToken:true})});assert.equal(r.status,200);tokens[name]=(await r.json()).idToken;
 }
 await db.doc(`ateliers/${tenant}/orders/order`).set({atelierId:tenant,status:'confirmed',clientUserId:users.client.uid});
 await db.doc(assetPath).set({id,atelierId:tenant,orderId:'order',provider:'viii-http-transport-fixture',state:'READY',synthetic:true,size:bytes.length,sha256:sha,mime:'application/pdf',shared:true,revision:1});
 await db.doc('mediaReferencesV8/'+id).set({atelierId:tenant});
 server=createServer(async(req,res)=>{
  if(req.headers.authorization!=='Bearer '+secret||req.url!=='/objects/'+id){res.writeHead(403);res.end();return;}served++;
  if(behavior==='revoke-member')await db.doc(`ateliers/${tenant}/members/${users.a.uid}`).update({active:false});
  if(behavior==='disable-auth')await auth.updateUser(users.a.uid,{disabled:true});
  if(behavior==='change-revision')await db.doc(assetPath).update({revision:2});
  const data=behavior==='tamper'?Buffer.concat([Buffer.from('BAD!!'),bytes.subarray(5)]):behavior==='truncate'?bytes.subarray(0,-1):behavior==='oversize'?Buffer.concat([bytes,Buffer.from([0])]):bytes;
  res.writeHead(200,{'Content-Type':'application/pdf','Cache-Control':'private, no-store'});
  await pipeline(Readable.from((function*(){for(let offset=0;offset<data.length;offset+=512*1024)yield data.subarray(offset,offset+512*1024);})()),res).catch(()=>{});
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const built=await build({entryPoints:[root+'infrastructure/feasibility/src/worker.mjs'],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:crypto','node:buffer','node:process']});
 const bindings={...env,BLOB_FIXTURE_ORIGIN:'http://127.0.0.1:'+server.address().port,BLOB_FIXTURE_SECRET:secret};
 const options={modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-10-26',compatibilityFlags:['nodejs_compat'],limits:{cpuMs:10,subrequests:50}};
 const make=values=>{const parsed=convertV4MiniflareOptions(values);for(const worker of parsed.workers)worker.config.limits={cpuMs:10,subrequests:50};return parsed;};
 strict=new Miniflare(make({workers:[{...options,name:'viii-strict',bindings}]}));
 diagnostic=new Miniflare(make({inspectorPort:0,workers:[{...options,name:'viii-diagnostic',bindings:{...bindings,DIAGNOSTIC_UNENFORCED_CPU:'local-synthetic-only'}}]}));
 await strict.ready;await diagnostic.ready;
},{timeout:60000});
after(async()=>{await strict?.dispose();await diagnostic?.dispose();await new Promise(resolve=>server?.close(resolve));await deleteApp(app);});
test('strict CPU guard refuses20MiB before any provider bytes; public cron and query overrides unavailable',async()=>{
 const before=served,r=await request(strict);assert.equal(r.status,503);assert.equal((await r.json()).error.code,'CPU_ENFORCER_UNAVAILABLE');assert.equal(served,before);
 assert.equal((await strict.dispatchFetch('http://localhost/cron')).status,404);
 assert.equal((await strict.dispatchFetch('http://localhost/verify/'+id+'?DIAGNOSTIC_UNENFORCED_CPU=local-synthetic-only')).status,404);
});
test('configured10ms calibration is not a CPU guarantee; report actual DevTools observations separately',async()=>{
 const p=await profileInvocation(diagnostic,async()=>{const r=await diagnostic.dispatchFetch('http://localhost/calibrate');assert.equal(r.status,200);return r.json();});
 assert.equal(p.result.cpuEnforced,false);assert.equal(p.result.measuredInvocationCpuMs,null);observations.push({scope:'calibration',...p});
});
test('diagnostic workerd reads and SHA-verifies exact20MiB with one binary fetch and full canonical authorization',async()=>{
 const p=await profileInvocation(diagnostic,async()=>{const r=await request(diagnostic);assert.equal(r.status,200);return r.json();});
 assert.equal(p.result.size,bytes.length);assert.equal(p.result.digest,sha);assert.ok(p.result.subrequests<=50);assert.equal(p.result.hostedAcceptance,false);observations.push({scope:'20MiB-stream-verification',...p});
});
test('diagnostic original download is20MiB byte-for-byte; client ownership works without a signed permanent URL',async()=>{
 const p=await profileInvocation(diagnostic,async()=>{const r=await request(diagnostic,'download',tokens.client);assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');const report=JSON.parse(r.headers.get('X-Resource-Budget'));const body=Buffer.from(await r.arrayBuffer());assert.equal(body.length,bytes.length);assert.equal(createHash('sha256').update(body).digest('hex'),sha);return report;});
 observations.push({scope:'20MiB-buffered-download-diagnostic',...p});
});
test('invalid/expired/fakeUID sessions and tenantB are denied before blob; no direct public bytes',async()=>{
 const before=served;assert.equal((await request(diagnostic,'verify','invalid')).status,401);
 const parts=tokens.a.split('.'),claims=JSON.parse(Buffer.from(parts[1],'base64url'));claims.exp=1;
 assert.equal((await request(diagnostic,'verify',parts[0]+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.')).status,401);
 claims.exp=Math.floor(Date.now()/1000)+600;claims.sub='nonexistent-synthetic-user';assert.equal((await request(diagnostic,'verify',parts[0]+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.')).status,401);
 assert.equal((await request(diagnostic,'verify',tokens.b)).status,403);assert.equal(served,before);
 assert.equal((await fetch('http://127.0.0.1:'+server.address().port+'/objects/'+id)).status,403);
});
test('server canonical hash rejects tampering, truncated and20MiB+1 bytes without disclosing a download',async()=>{
 for(const mode of['tamper','truncate','oversize']){behavior=mode;const r=await request(diagnostic,'download');assert.equal(r.status,409);assert.ok((await r.text()).length<2000);}behavior='normal';
});
test('membership/Auth revocation or revision change during read invalidates response; pending state cannot publish',async()=>{
 behavior='revoke-member';assert.equal((await request(diagnostic,'download')).status,403);await db.doc(`ateliers/${tenant}/members/${users.a.uid}`).update({active:true});
 behavior='disable-auth';assert.equal((await request(diagnostic,'download')).status,401);await auth.updateUser(users.a.uid,{disabled:false});
 behavior='change-revision';assert.equal((await request(diagnostic,'download')).status,403);behavior='normal';await db.doc(assetPath).update({state:'PENDING'});assert.equal((await request(diagnostic)).status,403);await db.doc(assetPath).update({state:'READY'});
});
test('scheduled strict event fails closed on CPU guarantee; report cannot promote hosted CPU/RAM/financial acceptance',async()=>{
 const worker=await strict.getWorker('viii-strict');const result=await worker.scheduled({scheduledTime:new Date(),cron:'0 * * * *'});assert.equal(result.outcome,'exception');
 await mkdir(root+'.local/capacity-free',{recursive:true});await writeFile(root+'.local/capacity-free/runtime.json',JSON.stringify({runtime:'workerd-local',limitsRequested:{cpuMs:10,subrequests:50},limitsRetainedInNativeV5Config:true,metadataInventory:{assetJsonBytes:Buffer.byteLength(JSON.stringify((await db.doc(assetPath).get()).data())),notFirestoreBilledBytes:true,noBlobBytesInFirestore:true},hosted:false,cutover:false,observations},null,2));
 console.log('GVIII_RUNTIME_OBSERVATIONS',JSON.stringify(observations.map(o=>({scope:o.scope,subrequests:o.result.subrequests,bytes:o.result.size,wallMs:o.metrics.wallMs,devToolsNonIdleSamplingWindowMs:o.metrics.devToolsNonIdleSamplingWindowMs,cpuEnforced:o.result.cpuEnforced,hostedAcceptance:false}))));
});
