import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {SupabaseStorageAdapter,hashBytes,MAX_FILE_BYTES} from '../src/storage.mjs';
import {pdfBytes} from './fixtures.mjs';
import {tusUpload} from './storage-api-double.mjs';
const path=(await readFile('.local/media-v7/oss-connection-path.txt','utf8')).trim();
if(!path.includes('/.local/media-v7/cosmaker-media-v7-'))throw Error('Only locally generated connection manifest');
const config=JSON.parse(await readFile(path,'utf8'));if(config.kind!=='OFFICIAL_SUPABASE_STORAGE_OSS_LOCAL_NOT_HOSTED_FREE'||config.origin!=='http://127.0.0.1:15400')throw Error('Not a local proof');
const provider=new SupabaseStorageAdapter(config.origin,config.service,{apiPrefix:'',kind:'official-local'});
let cap,key,bytes;let nativeReady=false;const observations=[];
before(async()=>{const r=await provider.api('bucket','POST',JSON.stringify({id:'cosmaker-media-proof',name:'cosmaker-media-proof',public:false,file_size_limit:MAX_FILE_BYTES,allowed_mime_types:['application/pdf','image/png','image/jpeg','image/webp']}),{'Content-Type':'application/json'});if(!r.ok){const body=await r.json();if(!String(body.message||body.error).includes('already'))throw Error('Bucket creation failed '+r.status+' '+body.message);}});
test('Official Supabase Storage OSS: private 20 MiB signed-TUS interrupted/resumed with original bytes',async()=>{
 key='proof/native-tenant/'+randomBytes(32).toString('hex')+'/1';bytes=pdfBytes(MAX_FILE_BYTES);cap=await provider.begin(key,{size:bytes.length,sha256:hashBytes(bytes),mime:'application/pdf'});
 const partial=await tusUpload({...cap,mime:'application/pdf'},bytes,{interruptAfterChunks:1});assert.equal(partial.offset,6*1024*1024);
 await tusUpload({...cap,mime:'application/pdf'},bytes,{resource:partial.resource});
 const info=await provider.inspect(key);observations.push({kind:'OFFICIAL_STORAGE_OSS_NOT_HOSTED_FREE',infoFields:Object.keys(info),tusResume:true,bytes:bytes.length});
 const verified=await provider.verify(key,{size:bytes.length,sha256:hashBytes(bytes),mime:'application/pdf'});assert.equal(verified.sha256,hashBytes(bytes));nativeReady=true;
},{timeout:120000});
test('Official private bucket/RLS denies public, anon and authenticated roles; no membership assumptions',async()=>{
 assert.equal(nativeReady,true,'20MiB prerequisite');
 for(const [type,token]of[['public',null],['authenticated',config.anon],['authenticated',config.authenticated]]){
  const r=await fetch(config.origin+'/object/'+type+'/cosmaker-media-proof/'+key,{headers:token?{Authorization:'Bearer '+token}:{}});
  assert.equal(r.status,400);const body=await r.json();assert.ok(body.error||body.message);observations.push({access:type,role:token===config.anon?'anon':token===config.authenticated?'authenticated':'public',deniedStatus:r.status});
 }
});
test('Official immutable signed upload rejects existing object and 20 MiB+1 TUS length',async()=>{
 assert.equal(nativeReady,true,'20MiB prerequisite');
 const meta=(key,size)=>({'Tus-Resumable':'1.0.0','Upload-Length':String(size),'x-signature':cap.providerToken,'Upload-Metadata':Object.entries({bucketName:'cosmaker-media-proof',objectName:key,contentType:'application/pdf'}).map(([k,v])=>k+' '+Buffer.from(v).toString('base64')).join(',')});
 const changed=Buffer.from(bytes);changed[300]^=1;await assert.rejects(tusUpload({...cap,mime:'application/pdf'},changed),/TUS/);await provider.verify(key,{size:bytes.length,sha256:hashBytes(bytes),mime:'application/pdf'});
 const other='proof/native-tenant/'+randomBytes(32).toString('hex')+'/1';const otherCap=await provider.begin(other,{size:MAX_FILE_BYTES,sha256:hashBytes(bytes),mime:'application/pdf'});
 const extra=await fetch(otherCap.tusEndpoint,{method:'POST',headers:{...meta(other,MAX_FILE_BYTES+1),'x-signature':otherCap.providerToken}});assert.ok(extra.status>=400);observations.push({oversizedRejected:extra.status,immutableOverwriteRejected:true});
 await assert.rejects(tusUpload({...cap,key:other,mime:'application/pdf'},pdfBytes(600)),/TUS/);
 const forged=cap.providerToken.split('.');forged[1]=Buffer.from(JSON.stringify({exp:9999999999,url:'forged'})).toString('base64url');
 await assert.rejects(tusUpload({...cap,providerToken:forged.join('.'),mime:'application/pdf'},pdfBytes(600)),/TUS/);
});
test('Official Storage API synthetic delete operates on exact proof key; metadata SQL deletion is never used',async()=>{
 assert.equal(nativeReady,true,'20MiB prerequisite');
 await assert.rejects(provider.remove(key,{}),/dry-run/);await provider.remove(key,{mode:'SYNTHETIC_APPLY',project:'demo-cosmaker',fixture:true});
 await assert.rejects(provider.inspect(key),/unavailable/);
 await writeFile('.local/media-v7/native-storage-observations.json',JSON.stringify({observations,hostedProject:false,billing:false,firebaseJwtIntegration:'NOT_TESTED',imageTransforms:false},null,2));
 console.log('GVII_OFFICIAL_STORAGE_OSS',JSON.stringify(observations));
});
