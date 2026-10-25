import {createHash,timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {MiB} from './policy.mjs';
export const MAX_FILE_BYTES=20*MiB;
export const PART_BYTES=512*1024;
export const hashBytes=b=>createHash('sha256').update(b).digest('hex');
export function assertLocalOrigin(value){const u=new URL(value);if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||!u.port||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Only literal loopback provider origins');return u.origin;}
export function assertKey(value){if(typeof value!=='string'||!/^proof\/[A-Za-z0-9_-]+\/[a-f0-9]{64}\/[1-9][0-9]*$/.test(value))throw Error('Untrusted media key');return value;}
export function validateMedia(bytes,mime){
 if(!bytes.length)return false;
 if(mime==='application/pdf')return bytes.subarray(0,5).toString('ascii')==='%PDF-';
 if(mime==='image/png')return bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(mime==='image/jpeg')return bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 return mime==='image/webp'&&bytes.length>=12&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
}
export class MediaStorageProvider {
 name='abstract';localSyntheticOnly=true;requests=0;
 async begin(){throw Error('Not implemented');}async putPart(){throw Error('Not implemented');}async inspect(){throw Error('Not implemented');}
 async *read(){throw Error('Not implemented');}async remove(){throw Error('Not implemented');}
 async verify(key,expected){let size=0,first=null;const hash=createHash('sha256');for await(const bytes of this.read(key)){size+=bytes.length;if(size>expected.size)throw Error('Byte size exceeds reservation');hash.update(bytes);if(!first)first=bytes.subarray(0,16);}const digest=hash.digest('hex');if(size!==expected.size||digest!==expected.sha256||!validateMedia(first||Buffer.alloc(0),expected.mime))throw Error('Media integrity mismatch');return{size,sha256:digest,mime:expected.mime};}
}
export class RtdbChunkProvider extends MediaStorageProvider {
 name='rtdb-chunked-local';
 constructor(origin){super();this.origin=assertLocalOrigin(origin);}
 async api(path,method='GET',body,headers={}){if(!/^mediaV7\/[A-Za-z0-9_/-]+$/.test(path))throw Error('Invalid RTDB path');this.requests++;const r=await fetch(`${this.origin}/${path}.json?ns=demo-cosmaker-default-rtdb`,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'manual',signal:AbortSignal.timeout(20000)});return r;}
 path(key){assertKey(key);return 'mediaV7/objects/'+key;}
 async begin(key,expected){const r=await this.api(this.path(key)+'/header','PUT',{size:expected.size,sha256:expected.sha256,mime:expected.mime},{'if-match':'null_etag'});if(r.status===412){const old=await this.api(this.path(key)+'/header');if(JSON.stringify(await old.json())!==JSON.stringify({size:expected.size,sha256:expected.sha256,mime:expected.mime})){// JSON key order is not an authority.
 const check=await this.inspect(key);if(check.size!==expected.size||check.sha256!==expected.sha256||check.mime!==expected.mime)throw Error('Immutable upload collision');}
 }else if(!r.ok)throw Error('RTDB reservation unavailable');}
 async putPart(key,index,bytes,expected){
  if(!Number.isSafeInteger(index)||index<0||index>=Math.ceil(expected.size/PART_BYTES)||bytes.length!==Math.min(PART_BYTES,expected.size-index*PART_BYTES))throw Error('Unexpected chunk offset or size');
  const value={size:bytes.length,sha256:hashBytes(bytes),base64:bytes.toString('base64')};
  const path=this.path(key)+'/parts/'+String(index).padStart(4,'0');const r=await this.api(path,'PUT',value,{'if-match':'null_etag'});
  if(r.status===412){const old=await this.api(path);const v=await old.json();if(v?.sha256!==value.sha256||v?.size!==value.size||v?.base64!==value.base64)throw Error('Immutable chunk collision');}
  else if(!r.ok)throw Error('Chunk upload failed');
  return{index,size:bytes.length,sha256:value.sha256};
 }
 async inspect(key){const r=await this.api(this.path(key)+'/header');if(!r.ok)throw Error('Object header unavailable');return await r.json();}
 async *read(key){const header=await this.inspect(key);if(!header||!Number.isSafeInteger(header.size)||header.size<1||header.size>MAX_FILE_BYTES)throw Error('Invalid manifest');for(let index=0;index<Math.ceil(header.size/PART_BYTES);index++){const r=await this.api(this.path(key)+'/parts/'+String(index).padStart(4,'0'));const value=await r.json();if(!r.ok||!value||typeof value.base64!=='string'||value.base64.length>4*Math.ceil(PART_BYTES/3))throw Error('Missing or oversized chunk');const bytes=Buffer.from(value.base64,'base64');if(bytes.length!==Math.min(PART_BYTES,header.size-index*PART_BYTES)||value.size!==bytes.length||hashBytes(bytes)!==value.sha256)throw Error('Chunk checksum mismatch');yield bytes;}}
 async remove(key,context){assertSyntheticDelete(context);const r=await this.api(this.path(key),'DELETE');if(!r.ok)throw Error('Storage API delete failed');}
}
export function assertSyntheticDelete(context){if(context?.mode!=='SYNTHETIC_APPLY'||context.project!=='demo-cosmaker'||context.fixture!==true)throw Error('Deletion is dry-run by default; synthetic proof context required');}
export class SupabaseStorageAdapter extends MediaStorageProvider {
 name='supabase-storage-protocol-double';
 constructor(origin,serverCredential,{apiPrefix='/storage/v1',kind='double'}={}){super();this.origin=assertLocalOrigin(origin);if(!['','/storage/v1'].includes(apiPrefix))throw Error('Unsupported storage API prefix');this.apiPrefix=apiPrefix;this.name=kind==='official-local'?'supabase-storage-oss-local':'supabase-storage-protocol-double';this.credential=serverCredential;if(typeof serverCredential!=='string'||serverCredential.length<32)throw Error('Synthetic server credential required');}
 async api(path,method='GET',body,headers={}){this.requests++;return fetch(this.origin+this.apiPrefix+'/'+path,{method,headers:{Authorization:'Bearer '+this.credential,...headers},...(body===undefined?{}:{body}),redirect:'manual',signal:AbortSignal.timeout(20000)});}
 async begin(key,expected){assertKey(key);const r=await this.api('object/upload/sign/cosmaker-media-proof/'+key,'POST',JSON.stringify({upsert:false}),{'Content-Type':'application/json'});if(!r.ok)throw Error('Signed upload capability unavailable');const result=await r.json();const token=result.token||new URL(result.url,this.origin).searchParams.get('token');const tokenPayload=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));return{providerToken:token,expiresAt:new Date(tokenPayload.exp*1000).toISOString(),tusEndpoint:this.origin+this.apiPrefix+'/upload/resumable'+(this.name==='supabase-storage-oss-local'?'/sign':''),bucket:'cosmaker-media-proof',key,expectedSize:expected.size};}
 async putPart(){throw Error('Supabase candidate uses direct TUS; token is never service_role');}
 async inspect(key){assertKey(key);const r=await this.api('object/info/cosmaker-media-proof/'+key);if(!r.ok)throw Error('Object info unavailable');return await r.json();}
 async *read(key){assertKey(key);const info=await this.inspect(key);if(!Number.isSafeInteger(info.size)||info.size<1||info.size>MAX_FILE_BYTES)throw Error('Provider object size invalid');for(let offset=0;offset<info.size;offset+=PART_BYTES){const r=await this.api('object/authenticated/cosmaker-media-proof/'+key,'GET',undefined,{Range:`bytes=${offset}-${Math.min(offset+PART_BYTES,info.size)-1}`});if(r.status!==206)throw Error('Provider range semantics not proven');const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length!==Math.min(PART_BYTES,info.size-offset))throw Error('Range length mismatch');yield bytes;}}
 async signedRead(key,seconds){assertKey(key);const r=await this.api('object/sign/cosmaker-media-proof/'+key,'POST',JSON.stringify({expiresIn:seconds}),{'Content-Type':'application/json'});if(!r.ok)throw Error('Signing failed');return await r.json();}
 async remove(key,context){assertSyntheticDelete(context);assertKey(key);const r=await this.api('object/cosmaker-media-proof','DELETE',JSON.stringify({prefixes:[key]}),{'Content-Type':'application/json'});if(!r.ok)throw Error('Storage API delete failed');}
}
export function equalSecret(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);}
