// Explicit protocol double, NOT Supabase or RLS acceptance. Real HTTP + disk bytes.
import {createServer} from 'node:http';
import {createHmac,randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,writeFile,readFile,appendFile,stat,unlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MAX_FILE_BYTES,assertKey,equalSecret} from '../src/storage.mjs';
export async function storageApiDouble({now=()=>Date.now()}={}){
 const root=await mkdtemp(join(tmpdir(),'cosmaker-media-proof-')),secret=randomBytes(48).toString('hex'),jwtSecret=randomBytes(48),objects=new Map(),sessions=new Map();
 const sign=payload=>{const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),data=Buffer.from(JSON.stringify(payload)).toString('base64url');return head+'.'+data+'.'+createHmac('sha256',jwtSecret).update(head+'.'+data).digest('base64url');};
 const verify=(token,kind,key)=>{try{const [h,p,s]=token.split('.');const expected=createHmac('sha256',jwtSecret).update(h+'.'+p).digest('base64url');const value=JSON.parse(Buffer.from(p,'base64url'));if(!equalSecret(s,expected)||value.kind!==kind||value.key!==key||value.exp*1000<=now())throw Error();return value;}catch{throw Object.assign(Error('Capability expired or invalid'),{status:403});}};
 async function body(req,max=6*1024*1024){const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>max)throw Object.assign(Error('Payload too large'),{status:413});chunks.push(chunk);}return Buffer.concat(chunks);}
 const server=createServer(async(req,res)=>{
  const output=(status,value,headers={})=>{res.writeHead(status,{'Cache-Control':'private, no-store',...headers});res.end(value===undefined?'':Buffer.isBuffer(value)?value:JSON.stringify(value));};
  try {
   const url=new URL(req.url,'http://localhost'),p=url.pathname;
   const admin=equalSecret(req.headers.authorization,'Bearer '+secret);
   if(req.method==='OPTIONS'&&p==='/storage/v1/upload/resumable')return output(204,undefined,{'Tus-Version':'1.0.0','Tus-Resumable':'1.0.0','Tus-Extension':'creation,expiration','Tus-Max-Size':String(MAX_FILE_BYTES)});
   const uploadSign=p.match(/^\/storage\/v1\/object\/upload\/sign\/cosmaker-media-proof\/(.+)$/);
   if(uploadSign&&req.method==='POST'){
    if(!admin)return output(403,{error:'Permission denied'});const key=assertKey(decodeURIComponent(uploadSign[1]));
    const data=JSON.parse((await body(req,4096)).toString());if(data.upsert===true)return output(400,{error:'Immutable only'});
    const token=sign({kind:'upload',key,upsert:false,exp:Math.floor(now()/1000)+7200});return output(200,{url:'/object/upload/sign/cosmaker-media-proof/'+key+'?token='+token,token});
   }
   if(p==='/storage/v1/upload/resumable'&&req.method==='POST'){
    const values=Object.fromEntries(String(req.headers['upload-metadata']||'').split(',').filter(Boolean).map(v=>{const [k,b]=v.trim().split(' ');return[k,Buffer.from(b||'','base64').toString()];}));
    if(values.bucketName!=='cosmaker-media-proof')return output(403,{error:'Bucket denied'});const key=assertKey(values.objectName);verify(String(req.headers['x-signature']||''),'upload',key);
    const size=Number(req.headers['upload-length']);if(!Number.isSafeInteger(size)||size<1||size>MAX_FILE_BYTES)return output(413,{error:'Maximum file size is 20 MiB'});
    if(objects.has(key)||req.headers['x-upsert']==='true')return output(400,{error:'Asset Already Exists'});
    const id=randomUUID(),file=join(root,id);await writeFile(file,Buffer.alloc(0),{flag:'wx'});sessions.set(id,{key,size,offset:0,file,mime:values.contentType,lock:false,tokenExpiry:now()+7200000});
    return output(201,undefined,{'Location':'/storage/v1/upload/resumable/'+id,'Upload-Offset':'0','Tus-Resumable':'1.0.0','Upload-Expires':new Date(now()+24*3600000).toUTCString()});
   }
   const tus=p.match(/^\/storage\/v1\/upload\/resumable\/([a-f0-9-]+)$/);
   if(tus){const s=sessions.get(tus[1]);if(!s)return output(404,{error:'Upload missing'});verify(String(req.headers['x-signature']||''),'upload',s.key);
    if(req.method==='HEAD')return output(200,undefined,{'Upload-Offset':String(s.offset),'Upload-Length':String(s.size),'Tus-Resumable':'1.0.0'});
    if(req.method!=='PATCH')return output(405,{error:'Method denied'});
    if(s.lock||Number(req.headers['upload-offset'])!==s.offset)return output(409,{error:'Offset conflict'});
    if(req.headers['upload-checksum'])return output(400,{error:'Checksum extension not declared; do not assume server SHA-256'});
    s.lock=true;try{const bytes=await body(req);if(!bytes.length||s.offset+bytes.length>s.size)return output(413,{error:'Upload length exceeded'});if(s.offset+bytes.length<s.size&&bytes.length!==6*1024*1024)return output(400,{error:'Non-final chunk must be 6 MiB'});await appendFile(s.file,bytes);s.offset+=bytes.length;
     if(s.offset===s.size){if(objects.has(s.key))return output(400,{error:'Asset Already Exists'});objects.set(s.key,{file:s.file,size:s.size,mime:s.mime});}
     return output(204,undefined,{'Upload-Offset':String(s.offset),'Tus-Resumable':'1.0.0'});
    }finally{s.lock=false;}
   }
   const info=p.match(/^\/storage\/v1\/object\/info\/cosmaker-media-proof\/(.+)$/);
   if(info&&req.method==='GET'){if(!admin)return output(403,{error:'Permission denied'});const object=objects.get(assertKey(decodeURIComponent(info[1])));return object?output(200,{size:(await stat(object.file)).size,contentType:object.mime}):output(404,{error:'Not found'});}
   const signed=p.match(/^\/storage\/v1\/object\/sign\/cosmaker-media-proof\/(.+)$/);
   if(signed&&req.method==='POST'){if(!admin)return output(403,{error:'Permission denied'});const key=assertKey(decodeURIComponent(signed[1]));if(!objects.has(key))return output(404,{error:'Not found'});const data=JSON.parse((await body(req,4096)).toString());if(!Number.isSafeInteger(data.expiresIn)||data.expiresIn<1||data.expiresIn>60)return output(400,{error:'Short TTL required'});const token=sign({kind:'download',key,exp:Math.floor(now()/1000)+data.expiresIn});return output(200,{signedURL:'/object/sign/cosmaker-media-proof/'+key+'?token='+token});}
   const get=p.match(/^\/storage\/v1\/object\/(authenticated|public|sign)\/cosmaker-media-proof\/(.+)$/);
   if(get&&req.method==='GET'){
    const key=assertKey(decodeURIComponent(get[2]));if(get[1]==='public')return output(403,{error:'Private bucket'});
    if(get[1]==='sign')verify(url.searchParams.get('token')||'','download',key);else if(!admin)return output(403,{error:'Permission denied'});
    const object=objects.get(key);if(!object)return output(404,{error:'Not found'});
    const range=req.headers.range?.match(/^bytes=(\d+)-(\d+)$/);const bytes=await readFile(object.file);
    if(range){const a=Number(range[1]),b=Math.min(Number(range[2]),bytes.length-1);if(a>b)return output(416,{error:'Range invalid'});return output(206,bytes.subarray(a,b+1),{'Content-Type':object.mime,'Content-Range':`bytes ${a}-${b}/${bytes.length}`});}
    return output(200,bytes,{'Content-Type':object.mime});
   }
   if(p==='/storage/v1/object/cosmaker-media-proof'&&req.method==='DELETE'){
    if(!admin)return output(403,{error:'Permission denied'});const data=JSON.parse((await body(req,4096)).toString());if(!Array.isArray(data.prefixes)||data.prefixes.length!==1)return output(400,{error:'Exact single key required'});const key=assertKey(data.prefixes[0]),object=objects.get(key);if(object){await unlink(object.file);objects.delete(key);}return output(200,[{name:key}]);
   }
   return output(403,{error:'No public read or write route'});
  }catch(error){if(!res.headersSent)output(error.status||400,{error:error.message});else res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return{origin:'http://127.0.0.1:'+server.address().port,credential:secret,objects,sessions,close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}};
}
export async function tusUpload(capability,bytes,{resource,startAt=0,interruptAfterChunks=Infinity}={}){
 const metadata={bucketName:capability.bucket,objectName:capability.key,contentType:capability.mime||'application/pdf',cacheControl:'0'};
 let url=resource;
 if(!url){const r=await fetch(capability.tusEndpoint,{method:'POST',headers:{'Tus-Resumable':'1.0.0','Upload-Length':String(bytes.length),'Upload-Metadata':Object.entries(metadata).map(([k,v])=>k+' '+Buffer.from(v).toString('base64')).join(','),'x-signature':capability.providerToken,'x-upsert':'false',...(capability.authorizationToken?{Authorization:'Bearer '+capability.authorizationToken}:{})}});if(r.status!==201)throw Error('TUS creation failed '+r.status+' '+(await r.text()).replaceAll(capability.providerToken,'[redacted]'));url=new URL(r.headers.get('location'),capability.tusEndpoint).href;}
 else{const head=await fetch(url,{method:'HEAD',headers:{'Tus-Resumable':'1.0.0','x-signature':capability.providerToken,...(capability.authorizationToken?{Authorization:'Bearer '+capability.authorizationToken}:{})}});if(!head.ok)throw Error('TUS resume failed '+head.status);startAt=Number(head.headers.get('upload-offset'));}
 let count=0;
 for(let offset=startAt;offset<bytes.length;offset+=6*1024*1024){if(count++>=interruptAfterChunks)return{resource:url,offset};const part=bytes.subarray(offset,Math.min(offset+6*1024*1024,bytes.length));const r=await fetch(url,{method:'PATCH',headers:{'Tus-Resumable':'1.0.0','Content-Type':'application/offset+octet-stream','Upload-Offset':String(offset),'x-signature':capability.providerToken,...(capability.authorizationToken?{Authorization:'Bearer '+capability.authorizationToken}:{})},body:part});if(r.status!==204)throw Error('TUS PATCH failed '+r.status);}
 return{resource:url,offset:bytes.length};
}
