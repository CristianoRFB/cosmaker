import { Buffer } from 'node:buffer';
import { actor, permission } from './firestore.mjs';
import { fail, id, only, sha256 } from './core.mjs';

// Candidate capacity, NOT a reduction of the existing product's 20 MiB contract.
// Single-node RTDB strings are limited to 10 MB. Larger/chunked files are not accepted here.
export const CANDIDATE_FILE_BYTES=6*1024*1024;
export function validBytes(bytes,type) {
  if(type==='application/pdf') return bytes.length>=5&&Buffer.from(bytes.subarray(0,5)).toString('ascii')==='%PDF-';
  if(type==='image/png') return bytes.length>=8&&Buffer.from(bytes.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(type==='image/jpeg') return bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  return type==='image/webp'&&bytes.length>=12&&Buffer.from(bytes.subarray(0,4)).toString()==='RIFF'&&Buffer.from(bytes.subarray(8,12)).toString()==='WEBP';
}
export class Database {
  constructor(config,budget) {this.config=config;this.budget=budget;}
  async request(path,method='GET',body,headers={}) {
    if(!/^[A-Za-z0-9_/-]+$/.test(path)) fail('invalid-argument','Caminho RTDB inválido.');
    return this.budget.fetch(`${this.config.DATABASE_ORIGIN}/${path}.json?ns=demo-cosmaker-default-rtdb`,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  }
  async quota(update) {
    for(let n=0;n<3;n++) {
      const r=await this.request('spark/quota','GET',undefined,{'X-Firebase-ETag':'true'});
      if(!r.ok) fail('unavailable','Contabilidade indisponível.',503);
      const next=update(await r.json()||{stored:0,tenants:{},months:{},files:{}});
      const saved=await this.request('spark/quota','PUT',next,{'if-match':r.headers.get('etag')});
      if(saved.status===412) continue;
      if(!saved.ok) fail('unavailable','Reserva indisponível.',503);
      return;
    }
    fail('aborted','Contabilidade concorrente; tente novamente.',409);
  }
}
function limits(env) {
  const values=['FILE_GLOBAL_BYTES','FILE_TENANT_BYTES','FILE_MONTHLY_BYTES'].map(k=>Number(env[k]));
  if(values.some(v=>!Number.isSafeInteger(v)||v<=0)||values[0]>750_000_000||values[2]>7_500_000_000||values[1]>values[0]) fail('failed-precondition','Orçamento experimental ausente ou inseguro.',503);
  return values;
}
async function access(db,who,tenant,orderId,write,tx=db) {
  const orderPath=`ateliers/${tenant}/orders/${orderId}`;
  const order=await tx.get(orderPath);
  if(!order||(order.data.atelierId!==undefined&&order.data.atelierId!==tenant)) fail('permission-denied','Pedido indisponível.',403);
  if(write) {
    const a=await actor(db,who.uid,'orders:manage',tx);
    if(a.tenant!==tenant||a.atelier.demoWorkspace===true||['cancelled','refunded','completed'].includes(order.data.status)) fail('permission-denied','Envio indisponível.',403);
    return {order,staff:true};
  }
  const profile=(await tx.get(`users/${who.uid}`))?.data;
  const atelier=(await tx.get(`ateliers/${tenant}`))?.data;
  if(profile?.active!==true||atelier?.active!==true) fail('permission-denied','Acesso indisponível.',403);
  if(profile.accountType==='atelier_member'&&profile.atelierId===tenant) {
    const member=(await tx.get(`ateliers/${tenant}/members/${who.uid}`))?.data;
    if(permission(member,'orders:read')||permission(member,'orders:manage')) return {order,staff:true};
  }
  let clientUid=order.data.clientUserId;
  if(order.data.clientId!=null) {
    if(!id(order.data.clientId)) fail('permission-denied','Vínculo inválido.',403);
    const crm=await tx.get(`ateliers/${tenant}/clients/${order.data.clientId}`);
    if(!crm||(crm.data.userId&&clientUid&&crm.data.userId!==clientUid)) fail('permission-denied','Vínculo inconsistente.',403);
    clientUid=clientUid||crm.data.userId;
  }
  if(profile.accountType!=='client'||clientUid!==who.uid) fail('permission-denied','Arquivo indisponível.',403);
  return {order,staff:false};
}
export async function upload(req,db,rtdb,who,env,params) {
  const {tenant,orderId}=params;
  if(!id(tenant)||!id(orderId)) fail('invalid-argument','Pedido inválido.');
  const requestId=req.headers.get('x-request-id'),digest=req.headers.get('x-content-sha256'),type=req.headers.get('content-type')?.split(';')[0];
  if(!id(requestId)||!/^[a-f0-9]{64}$/.test(digest||'')) fail('invalid-argument','Hash ou chave inválidos.');
  const [globalMax,tenantMax,monthlyMax]=limits(env);
  // Bound actual stream, not a trusted Content-Length.
  const reader=req.body?.getReader(); if(!reader) fail('invalid-argument','Arquivo ausente.');
  let size=0;const chunks=[];
  while(true) { const {done,value}=await reader.read();if(done) break;size+=value.length;if(size>CANDIDATE_FILE_BYTES){await reader.cancel();fail('resource-exhausted','Candidato RTDB não preserva arquivos maiores que 6 MiB.',413);}chunks.push(value); }
  const bytes=Buffer.concat(chunks);
  if(!validBytes(bytes,type)||await sha256(bytes)!==digest) fail('invalid-argument','MIME, assinatura ou SHA-256 inválidos.');
  const fileId=await sha256(JSON.stringify([tenant,orderId,who.uid,requestId]));
  const fingerprint=await sha256(JSON.stringify([digest,type,size]));
  const metaPath=`ateliers/${tenant}/orders/${orderId}/sparkFiles/${fileId}`;
  const leaseId=crypto.randomUUID();
  const state=await db.transaction(async tx=>{
    const {order}=await access(db,who,tenant,orderId,true,tx);
    const old=(await tx.get(metaPath))?.data;
    if(old?.fingerprint&&old.fingerprint!==fingerprint) fail('failed-precondition','Chave ocupada por outro conteúdo.');
    if(old?.status==='ready') return {ready:true};
    if(old?.leaseUntil instanceof Date&&old.leaseUntil.getTime()>Date.now()) fail('aborted','Envio em andamento.',409);
    const value={fingerprint,sha256:digest,size,contentType:type,actorId:who.uid,visibleToClient:true,status:'pending',leaseId,leaseUntil:new Date(Date.now()+30000),orderVersion:order.version,createdAt:old?.createdAt||new Date()};
    tx.set(metaPath,value);return {ready:false,orderVersion:order.version};
  });
  if(state.ready) return {fileId,alreadyApplied:true};
  const base64=bytes.toString('base64'),storedBytes=new TextEncoder().encode(JSON.stringify({base64,sha256:digest,contentType:type})).length;
  // Reservations are retained on interruption. No background deletion or automatic quota refund.
  await rtdb.quota(q=>{
    const month=new Date().toISOString().slice(0,7);
    if(!q.files[fileId]) {
      if(Object.keys(q.files).length>=400||q.stored+storedBytes>globalMax||(q.tenants[tenant]||0)+storedBytes>tenantMax) fail('resource-exhausted','Armazenamento experimental esgotado.',429);
      q.stored+=storedBytes;q.tenants[tenant]=(q.tenants[tenant]||0)+storedBytes;q.files[fileId]={tenant,size:storedBytes};
    }
    // Counts potential existing-object reads on retry conservatively. Protocol/TLS accounting remains an external gate.
    if((q.months[month]||0)+storedBytes+65536>monthlyMax) fail('resource-exhausted','Tráfego experimental esgotado.',429);
    q.months[month]=(q.months[month]||0)+storedBytes+65536;return q;
  });
  const path=`spark/objects/${tenant}/${fileId}`;
  const saved=await rtdb.request(path,'PUT',{base64,sha256:digest,contentType:type},{'if-match':'null_etag'});
  if(saved.status===412) {
    const old=await rtdb.request(path);const value=await old.json();
    if(!old.ok||value.sha256!==digest||value.contentType!==type||await sha256(Buffer.from(value.base64,'base64'))!==digest) fail('already-exists','Conteúdo imutável divergente.',409);
  } else if(!saved.ok) fail('unavailable','Objeto pendente; retome com a mesma chave.',503);
  await db.transaction(async tx=>{
    const {order}=await access(db,who,tenant,orderId,true,tx);
    const meta=(await tx.get(metaPath))?.data;
    if(meta?.leaseId!==leaseId||meta?.status!=='pending'||order.version!==state.orderVersion) fail('failed-precondition','Pedido ou lease mudou; arquivo permanece pendente.');
    tx.set(metaPath,{status:'ready',leaseId:null,leaseUntil:new Date(0),readyAt:new Date()},['status','leaseId','leaseUntil','readyAt']);
    tx.create(`auditLogs/${crypto.randomUUID()}`,{actorId:who.uid,atelierId:tenant,action:'spark.file_ready',entity:'order',entityId:orderId,after:{fileId,sha256:digest,size},timestamp:new Date()});
  });
  return {fileId,alreadyApplied:false};
}
export async function download(db,rtdb,who,env,params) {
  const {tenant,orderId,fileId}=only(params,['tenant','orderId','fileId']);
  if(!id(tenant)||!id(orderId)||!id(fileId)) fail('invalid-argument','Referência inválida.');
  const check=()=>db.transaction(async tx=>{
    const a=await access(db,who,tenant,orderId,false,tx);
    const meta=(await tx.get(`ateliers/${tenant}/orders/${orderId}/sparkFiles/${fileId}`))?.data;
    if(!meta||meta.status!=='ready'||(!a.staff&&!meta.visibleToClient)||meta.archived) fail('permission-denied','Arquivo indisponível.',403);
    return meta;
  });
  const meta=await check();
  const [, , monthlyMax]=limits(env),charge=4*Math.ceil(meta.size/3)+65536;
  await rtdb.quota(q=>{const month=new Date().toISOString().slice(0,7);if((q.months[month]||0)+charge>monthlyMax)fail('resource-exhausted','Tráfego experimental esgotado.',429);q.months[month]=(q.months[month]||0)+charge;return q;});
  const r=await rtdb.request(`spark/objects/${tenant}/${fileId}`);
  if(!r.ok) fail('unavailable','Conteúdo indisponível.',503);
  const v=await r.json();
  if(!v||v.sha256!==meta.sha256||v.contentType!==meta.contentType) fail('failed-precondition','Metadados divergentes.');
  const bytes=Buffer.from(v.base64,'base64');
  if(bytes.length!==meta.size||await sha256(bytes)!==meta.sha256||!validBytes(bytes,meta.contentType)) fail('failed-precondition','Integridade inválida.');
  const after=await check();if(after.sha256!==meta.sha256) fail('permission-denied','Referência alterada.',403);
  return new Response(bytes,{headers:{'Content-Type':meta.contentType,'Content-Length':String(bytes.length),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'attachment','X-Content-SHA256':meta.sha256}});
}
