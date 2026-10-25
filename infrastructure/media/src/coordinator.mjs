import {randomUUID} from 'node:crypto';
import {hashBytes,MAX_FILE_BYTES,PART_BYTES} from './storage.mjs';
import {POLICY_VERSION,DAY,MiB,classifyDomain,retentionFor,deletionDecision,admission,tierOf,updateActivity} from './policy.mjs';
const validId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,150}$/.test(v);
export class MediaFault extends Error{constructor(code,message,status=400){super(message);this.code=code;this.status=status;}}
const deny=(message='Acesso indisponível.')=>{throw new MediaFault('permission-denied',message,403);};
const requireFields=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw new MediaFault('invalid-argument','Campos inválidos.');return v;};
const can=(m,p)=>m?.active===true&&(['owner','admin'].includes(m.role)||(Array.isArray(m.permissions)&&m.permissions.includes(p)));
const audit=(tx,tenant,actor,action,id,after,now)=>tx.create('auditLogs/'+randomUUID(),{atelierId:tenant,actorId:actor,action,entity:'media_asset_v7',entityId:id,after,timestamp:new Date(now)});
export class MediaCoordinator{
 constructor({db,provider,now=()=>Date.now(),enabled=false,project='demo-cosmaker',capacity=1_000_000_000}){
  if(!enabled||project!=='demo-cosmaker'||provider.localSyntheticOnly!==true)throw Error('Feature flag OFF or non-synthetic provider: no cutover');
  this.db=db;this.provider=provider;this.now=now;this.project=project;this.capacity=capacity;
 }
 assetPath(tenant,id){if(!validId(tenant)||!/^[a-f0-9]{64}$/.test(id))deny();return `ateliers/${tenant}/mediaAssetsV7/${id}`;}
 meterPath(){return 'mediaUsageV7/'+this.provider.name;}
 async staff(uid,tx=this.db){const p=(await tx.get('users/'+uid))?.data;if(p?.active!==true||p.accountType!=='atelier_member'||!validId(p.atelierId))deny();const root='ateliers/'+p.atelierId;const a=(await tx.get(root))?.data,m=(await tx.get(root+'/members/'+uid))?.data;if(a?.active!==true||a.demoWorkspace===true||!can(m,'orders:manage'))deny();return{tenant:p.atelierId,profile:p,member:m};}
 async access(who,tenant,asset,write=false,tx=this.db){
  const profile=(await tx.get('users/'+who.uid))?.data,atelier=(await tx.get('ateliers/'+tenant))?.data;
  if(profile?.active!==true||atelier?.active!==true||asset.atelierId!==tenant)deny();
  const order=(await tx.get(`ateliers/${tenant}/orders/${asset.orderId}`))?.data;if(!order||(order.atelierId!==undefined&&order.atelierId!==tenant))deny();
  if(profile.accountType==='atelier_member'&&profile.atelierId===tenant){const member=(await tx.get(`ateliers/${tenant}/members/${who.uid}`))?.data;if(can(member,'orders:manage')||(!write&&can(member,'orders:read')))return{staff:true,order};}
  if(write||profile.accountType!=='client'||asset.shared!==true)deny();
  let owner=order.clientUserId;
  if(order.clientId!=null){if(!validId(order.clientId))deny();const crm=(await tx.get(`ateliers/${tenant}/clients/${order.clientId}`))?.data;if(!crm||(owner&&crm.userId&&owner!==crm.userId))deny();owner=owner||crm.userId;}
  if(owner!==who.uid)deny();return{staff:false,order};
 }
 async create(who,input){
  const v=requireFields(input,['requestId','orderId','size','sha256','mime','shared']);
  if(!validId(v.requestId)||!validId(v.orderId)||!Number.isSafeInteger(v.size)||v.size<1||v.size>MAX_FILE_BYTES||!/^[a-f0-9]{64}$/.test(v.sha256||'')||!['application/pdf','image/jpeg','image/png','image/webp'].includes(v.mime)||typeof v.shared!=='boolean')throw new MediaFault('invalid-argument','Use PDF/JPEG/PNG/WebP entre 1 byte e 20 MiB; GIF/SVG não fazem parte do contrato atual.');
  const fingerprint=hashBytes(JSON.stringify(v)),id=hashBytes(JSON.stringify([who.uid,v.requestId]));
  const reservation=this.provider.name.startsWith('rtdb')?4*Math.ceil(v.size/3)+Math.ceil(v.size/PART_BYTES)*1024+4096:MAX_FILE_BYTES;
  const result=await this.db.transaction(async tx=>{
   const actor=await this.staff(who.uid,tx),path=this.assetPath(actor.tenant,id),old=(await tx.get(path))?.data;
   if(old){if(old.fingerprint!==fingerprint)throw new MediaFault('failed-precondition','Chave idempotente usada para outro arquivo.');if(['TOMBSTONED','REVOKED','DELETING'].includes(old.state))deny();return old;}
   const order=(await tx.get(`ateliers/${actor.tenant}/orders/${v.orderId}`));if(!order||['cancelled','refunded','completed'].includes(order.data.status))throw new MediaFault('failed-precondition','Pedido não aceita novo envio.');
   const meter=(await tx.get(this.meterPath()))?.data||{active:0,pending:0,tenants:{},egressEstimated:0,noticeFailure:false};
   const decision=admission({active:meter.active,pending:meter.pending,reserved:reservation,capacity:this.capacity,noticeFailure:meter.noticeFailure});
   if(!decision.allowed)throw new MediaFault('resource-exhausted','Novos uploads suspensos para preservar os arquivos existentes.',429);
   const now=this.now(),mediaClass=classifyDomain({domain:v.mime==='application/pdf'?'order_document':'order_reference',mime:v.mime});
   const asset={id,atelierId:actor.tenant,orderId:v.orderId,ownerUid:who.uid,fingerprint,size:v.size,sha256:v.sha256,mime:v.mime,shared:v.shared,mediaClass,provider:this.provider.name,key:`proof/${actor.tenant}/${id}/1`,state:'PENDING',revision:1,leaseFence:1,leaseUntil:new Date(now+300000),createdAt:new Date(now),reservation,activeBytes:0,policyVersion:POLICY_VERSION,origin:'synthetic_proof',synthetic:true,orderVersion:order.version,links:[{id:v.orderId,completedAt:null,protected:mediaClass==='PROTECTED_REGULATED'}],legalHold:false};
   tx.create(path,asset);tx.set(this.meterPath(),{...meter,pending:meter.pending+reservation,tenants:{...meter.tenants,[actor.tenant]:(meter.tenants[actor.tenant]||0)+reservation}});audit(tx,actor.tenant,who.uid,'media.reserved',id,{size:v.size,mediaClass,reservation,provider:this.provider.name},now);return asset;
  });
  if(result.state==='READY')return{asset:result,alreadyApplied:true};
  const upload=await this.provider.begin(result.key,{size:result.size,sha256:result.sha256,mime:result.mime});
  if(upload){await this.db.transaction(async tx=>{const current=(await tx.get(this.assetPath(result.atelierId,id)))?.data;if(current?.state!=='PENDING'||current.leaseFence!==result.leaseFence)throw new MediaFault('aborted','Lease mudou.',409);tx.set(this.assetPath(result.atelierId,id),{uploadExpiresAt:upload.expiresAt},['uploadExpiresAt']);});}
  return{asset:result,alreadyApplied:false,upload};
 }
 async authorizePending(who,tenant,id,fence){return this.db.transaction(async tx=>{const asset=(await tx.get(this.assetPath(tenant,id)))?.data;if(!asset||asset.state!=='PENDING'||asset.ownerUid!==who.uid||asset.leaseFence!==fence||asset.leaseUntil?.getTime()<=this.now())throw new MediaFault('failed-precondition','Reserva/lease expirou ou foi substituído.');await this.access(who,tenant,asset,true,tx);return asset;});}
 async putPart(who,tenant,id,fence,index,bytes){const asset=await this.authorizePending(who,tenant,id,fence);return this.provider.putPart(asset.key,index,bytes,asset);}
 async renew(who,tenant,id){return this.db.transaction(async tx=>{const path=this.assetPath(tenant,id),asset=(await tx.get(path))?.data;if(!asset||asset.state!=='PENDING'||asset.ownerUid!==who.uid)deny();await this.access(who,tenant,asset,true,tx);const fence=asset.leaseFence+1;tx.set(path,{leaseFence:fence,leaseUntil:new Date(this.now()+300000),revision:asset.revision+1},['leaseFence','leaseUntil','revision']);audit(tx,tenant,who.uid,'media.lease_renewed',id,{fence},this.now());return fence;});}
 async complete(who,tenant,id,fence){
  let asset=(await this.db.get(this.assetPath(tenant,id)))?.data;if(asset?.state==='READY'){await this.access(who,tenant,asset,true);return{alreadyApplied:true,asset};}
  asset=await this.authorizePending(who,tenant,id,fence);
  const beforeRequests=this.provider.requests,started=performance.now();const verification=await this.provider.verify(asset.key,asset);const verificationRequests=this.provider.requests-beforeRequests;
  const result=await this.db.transaction(async tx=>{
   const path=this.assetPath(tenant,id),current=(await tx.get(path))?.data;if(current?.state==='READY'){await this.access(who,tenant,current,true,tx);return{alreadyApplied:true,asset:current};}
   if(current?.state!=='PENDING'||current.leaseFence!==fence||current.leaseUntil.getTime()<=this.now())throw new MediaFault('aborted','Lease inválido na conclusão.',409);
   const access=await this.access(who,tenant,current,true,tx);const order=await tx.get(`ateliers/${tenant}/orders/${current.orderId}`);if(order.version!==current.orderVersion||['cancelled','refunded','completed'].includes(access.order.status))throw new MediaFault('failed-precondition','Pedido mudou; bytes permanecem pendentes e privados.');
   const meter=(await tx.get(this.meterPath()))?.data;if(!meter||meter.pending<current.reservation)throw new MediaFault('failed-precondition','Contabilidade inconsistente.');
   const activityPath=`ateliers/${tenant}/mediaActivityV7/current`,previous=(await tx.get(activityPath))?.data;
   const now=this.now(),events=[...(previous?.events||[]).filter(e=>Date.parse(e.at)>=now-30*DAY),{at:new Date(now).toISOString(),bytes:current.size}].slice(-30);
   const window={startAt:new Date(now-30*DAY).toISOString(),endAt:new Date(now).toISOString(),uploads:events.length,bytes:events.reduce((s,e)=>s+e.bytes,0)};
   const activity=updateActivity(previous||null,window)||{tier:tierOf(window)};
   const retention=retentionFor(current,activity.tier,now);
   const activeBytes=this.provider.name.startsWith('rtdb')?4*Math.ceil(current.size/3)+Math.ceil(current.size/PART_BYTES)*1024+4096:current.size;
   const ready={...current,state:'READY',revision:current.revision+1,activeBytes,retention,completedAt:new Date(now)};
   tx.set(path,ready);tx.set(this.meterPath(),{...meter,pending:meter.pending-current.reservation,active:meter.active+activeBytes,tenants:{...meter.tenants,[tenant]:meter.tenants[tenant]-current.reservation+activeBytes}});
   tx.set(activityPath,{...activity,events});tx.create(`ateliers/${tenant}/mediaUploadFactsV7/${id}`,{atelierId:tenant,assetId:id,size:current.size,recordedAt:new Date(now)});
   audit(tx,tenant,who.uid,'media.ready',id,{...verification,mediaClass:current.mediaClass},now);return{alreadyApplied:false,asset:ready};
  });
  return{...result,verificationRequests,verificationWallMs:performance.now()-started,workerFreeAcceptance:'BLOCKED_NOT_BENCHMARKED_ON_EDGE'};
 }
 async read(who,tenant,id){const asset=(await this.db.get(this.assetPath(tenant,id)))?.data;if(!asset||asset.state!=='READY')deny();await this.access(who,tenant,asset);
  // A local proof buffers exact bytes only after bounded provider iteration; NOT a Free Worker implementation.
  const chunks=[];for await(const bytes of this.provider.read(asset.key))chunks.push(bytes);const full=Buffer.concat(chunks);if(full.length!==asset.size||hashBytes(full)!==asset.sha256)throw new MediaFault('failed-precondition','Checksum inválido.');
  const after=(await this.db.get(this.assetPath(tenant,id)))?.data;if(after?.state!=='READY'||after.revision!==asset.revision)deny();await this.access(who,tenant,after);
  await this.db.transaction(async tx=>{const meter=(await tx.get(this.meterPath()))?.data;if(meter)tx.set(this.meterPath(),{egressEstimated:meter.egressEstimated+full.length},['egressEstimated']);});return{asset,bytes:full};
 }
 async revoke(who,tenant,id){return this.db.transaction(async tx=>{const path=this.assetPath(tenant,id),asset=(await tx.get(path))?.data;if(!asset)deny();await this.access(who,tenant,asset,true,tx);tx.set(path,{state:'REVOKED',revision:asset.revision+1},['state','revision']);audit(tx,tenant,who.uid,'media.revoked',id,{previous:asset.state},this.now());return{state:'REVOKED'};});}
 async getView(who,tenant,id){const a=(await this.db.get(this.assetPath(tenant,id)))?.data;if(!a||['DELETING','TOMBSTONED','REVOKED'].includes(a.state))deny();await this.access(who,tenant,a);return{id:a.id,state:a.state,size:a.size,mime:a.mime,mediaClass:a.mediaClass,shared:a.shared,retention:a.retention||{noAutoDelete:true,reason:'PENDING'},notices:a.notices||{},revision:a.revision};}
 async evaluateRetention(tenant,id,tier){
  const path=this.assetPath(tenant,id);return this.db.transaction(async tx=>{const asset=(await tx.get(path))?.data;if(!asset||asset.synthetic!==true||asset.origin!=='synthetic_proof'||asset.state!=='READY')return{skipped:true};
   // Re-read every canonical link. Missing/in-progress/regulated links protect the asset.
   const links=[];for(const link of asset.links||[]){const order=(await tx.get(`ateliers/${tenant}/orders/${link.id}`))?.data;links.push({id:link.id,completedAt:order?.status==='completed'&&order.completedAt instanceof Date?order.completedAt.toISOString():null,protected:link.protected===true||!order});}
   const current={...asset,links},retention=retentionFor(current,tier,this.now());const notices={...(asset.notices||{})};const meter=(await tx.get(this.meterPath()))?.data;
   const now=this.now();let failure=false;
   const recipients=[asset.ownerUid,...(asset.recipientUids||[])].filter((v,i,a)=>validId(v)&&a.indexOf(v)===i);
   const validRecipients=[];for(const uid of recipients){const p=(await tx.get('users/'+uid))?.data;if(p?.active===true)validRecipients.push(uid);}
   const notifications=[];
   for(const stage of ['warning','due']){const when=stage==='warning'?retention.warningAt:retention.dueAt;if(retention.noAutoDelete||!when||Date.parse(when)>now||notices[stage]?.recordedAt)continue;
    if(!validRecipients.length){notices[stage]={failed:true};failure=true;continue;}
    notices[stage]={recordedAt:new Date(now).toISOString(),channel:'internal_recorded',failed:false};for(const uid of validRecipients)notifications.push({uid,id:hashBytes(JSON.stringify([id,POLICY_VERSION,stage,when,uid])),stage});
   }
   tx.set(path,{links,retention,notices,revision:asset.revision+1},['links','retention','notices','revision']);
   if(failure&&meter)tx.set(this.meterPath(),{noticeFailure:true},['noticeFailure']);
   for(const n of notifications)tx.set(`users/${n.uid}/mediaNotificationsV7/${n.id}`,{atelierId:tenant,assetId:id,stage:n.stage,recordedAt:new Date(now),policyVersion:POLICY_VERSION});
   audit(tx,tenant,'system','media.retention_evaluated',id,{tier,noAutoDelete:retention.noAutoDelete,noticeFailure:failure},now);
   return deletionDecision({...current,retention,notices,revision:asset.revision+1},now);
  });
 }
 async planDeletion(tenant,id){const asset=(await this.db.get(this.assetPath(tenant,id)))?.data;return asset?{tenant,id,key:asset.key,...deletionDecision(asset,this.now())}:{eligible:false,reason:'MISSING'};}
 async applySyntheticDeletion(plan,{mode='DRY_RUN'}={}){
  if(mode!=='SYNTHETIC_APPLY')return{mode:'DRY_RUN',wouldDelete:plan.eligible===true};
  const path=this.assetPath(plan.tenant,plan.id);
  const tombstone=await this.db.transaction(async tx=>{const a=(await tx.get(path))?.data;if(a?.state==='TOMBSTONED')return a;const decision=a&&deletionDecision(a,this.now());if(!a||a.synthetic!==true||a.revision!==plan.expectedRevision||!decision.eligible)throw new MediaFault('aborted','Plano obsoleto, hold, aviso ou extensão alterou a decisão.',409);
   tx.set(path,{state:'DELETING',revision:a.revision+1},['state','revision']);tx.set(`mediaTombstonesV7/${a.id}`,{atelierId:a.atelierId,key:a.key,deletedAt:new Date(this.now()),generation:a.revision+1});audit(tx,plan.tenant,'system','media.deletion_fenced',a.id,{key:a.key},this.now());return{...a,revision:a.revision+1};});
  if(tombstone.state==='TOMBSTONED')return{alreadyApplied:true};
  await this.provider.remove(tombstone.key,{mode:'SYNTHETIC_APPLY',project:this.project,fixture:true});
  await this.db.transaction(async tx=>{const a=(await tx.get(path))?.data,m=(await tx.get(this.meterPath()))?.data;if(a?.state!=='DELETING'||a.revision!==tombstone.revision)throw Error('Deletion reconciliation required');tx.set(path,{state:'TOMBSTONED',deletedAt:new Date(this.now())},['state','deletedAt']);if(m)tx.set(this.meterPath(),{active:Math.max(0,m.active-a.activeBytes)},['active']);audit(tx,plan.tenant,'system','media.synthetic_deleted',a.id,{provider:this.provider.name},this.now());});return{mode,deleted:true};
 }
 async reconcile(who,tenant,id,fence){const a=(await this.db.get(this.assetPath(tenant,id)))?.data;if(!a||a.ownerUid!==who.uid)deny();if(a.state==='PENDING')return this.complete(who,tenant,id,fence);return{state:a.state};}
}
