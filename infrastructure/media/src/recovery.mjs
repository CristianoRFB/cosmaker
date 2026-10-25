import {hashBytes,PART_BYTES} from './storage.mjs';
import {MediaFault} from './coordinator.mjs';
const serialize=v=>JSON.parse(JSON.stringify(v));
const checksum=value=>hashBytes(JSON.stringify(value));
export async function backupMedia(core,who,tenant,id){const asset=(await core.db.get(core.assetPath(tenant,id)))?.data;if(!asset||asset.state!=='READY'||asset.synthetic!==true||core.project!=='demo-cosmaker')throw Error('Only ready synthetic media can be exported');await core.access(who,tenant,asset,true);const read=await core.read(who,tenant,id);const body={schemaVersion:1,project:'demo-cosmaker',metadata:serialize(asset),base64:read.bytes.toString('base64'),sha256:hashBytes(read.bytes)};return{...body,snapshotSha256:checksum(body)};}
export async function restoreMedia(core,who,snapshot,{mode='DRY_RUN'}={}){
 const{snapshotSha256,...body}=snapshot;if(body.project!=='demo-cosmaker'||core.project!=='demo-cosmaker'||body.schemaVersion!==1||checksum(body)!==snapshotSha256||body.metadata?.synthetic!==true)throw Error('Snapshot checksum or provenance invalid');
 const a=body.metadata;if(a.provider!==core.provider.name||a.origin!=='synthetic_proof')throw Error('Provider/provenance mismatch');const bytes=Buffer.from(body.base64,'base64');if(hashBytes(bytes)!==body.sha256||body.sha256!==a.sha256||bytes.length!==a.size)throw Error('Backup bytes do not match metadata');
 const path=core.assetPath(a.atelierId,a.id);await core.access(who,a.atelierId,a,true);
 if(await core.db.get('mediaTombstonesV7/'+a.id))throw Error('Tombstone prevents resurrection');
 if(mode!=='SYNTHETIC_APPLY')return{mode:'DRY_RUN',wouldRestore:true,bytes:bytes.length};
 if(core.provider.name.startsWith('supabase'))throw Error('Restore to real/native Supabase is not accepted; RTDB synthetic restore proof only');
 const operation=hashBytes(snapshotSha256);
 const state=await core.db.transaction(async tx=>{
  const current=(await tx.get(path))?.data,meter=(await tx.get(core.meterPath()))?.data,tombstone=await tx.get('mediaTombstonesV7/'+a.id);
  if(tombstone||!current||['TOMBSTONED','DELETING','REVOKED'].includes(current.state))throw Error('Current state prevents restore');
  await core.access(who,a.atelierId,current,true,tx);
  if(current.restoreOperation===operation&&current.state==='READY')return{alreadyRestored:true,asset:current};
  if(current.state==='RESTORING'){if(current.restoreOperation!==operation)throw Error('Different recovery already in progress');return{asset:current};}
  if(current.sha256!==a.sha256||current.size!==a.size||current.mime!==a.mime)throw Error('Snapshot differs from current immutable metadata');
  const restoring={...current,state:'RESTORING',restoreOperation:operation,restoreKey:`proof/${a.atelierId}/${a.id}/${current.revision+1}`,revision:current.revision+1};
  if(!meter||meter.active+meter.pending+current.reservation>core.capacity*.9)throw Error('Recovery capacity must be reserved before writing');
  tx.set(path,restoring);tx.set(core.meterPath(),{pending:meter.pending+current.reservation},['pending']);return{asset:restoring};
 });
 if(state.alreadyRestored)return{alreadyApplied:true};
 const current=state.asset;
 await core.provider.begin(current.restoreKey,{size:a.size,sha256:a.sha256,mime:a.mime});
 for(let i=0;i<Math.ceil(bytes.length/PART_BYTES);i++)await core.provider.putPart(current.restoreKey,i,bytes.subarray(i*PART_BYTES,(i+1)*PART_BYTES),a);
 await core.provider.verify(current.restoreKey,a);
 await core.db.transaction(async tx=>{const latest=(await tx.get(path))?.data,meter=(await tx.get(core.meterPath()))?.data,tomb=await tx.get('mediaTombstonesV7/'+a.id);if(tomb||latest?.state!=='RESTORING'||latest.restoreOperation!==operation||latest.revision!==current.revision)throw new MediaFault('aborted','Recovery fence changed.',409);
  tx.set(path,{...latest,key:latest.restoreKey,state:'READY',revision:latest.revision+1,restoredAt:new Date(core.now()),sourceSnapshotSha256:snapshotSha256});
  // Retain the old source reservation conservatively until provider inventory proves it absent.
  const orphans={...(meter.orphans||{}),[operation]:{key:current.key,tenant:a.atelierId,bytes:current.activeBytes}};
  tx.set(core.meterPath(),{pending:meter.pending-current.reservation+current.activeBytes,tenants:{...meter.tenants,[a.atelierId]:meter.tenants[a.atelierId]+current.activeBytes},orphans,orphanReconciliationRequired:true},['pending','tenants','orphans','orphanReconciliationRequired']);
  tx.create('auditLogs/'+operation,{atelierId:a.atelierId,actorId:who.uid,action:'media.synthetic_restored',entity:'media_asset_v7',entityId:a.id,after:{snapshotSha256,bytes:bytes.length},timestamp:new Date(core.now())});
 });
 return{restored:true,bytes:bytes.length,sha256:a.sha256,providerMeter:'CONSERVATIVE_ORPHAN_RESERVATION_PENDING_RECONCILIATION'};
}

// Never release reservations because a network call failed. Only a positive absent result qualifies.
export async function reconcileRecovery(core,operation){
 const meter=(await core.db.get(core.meterPath()))?.data,orphan=meter?.orphans?.[operation];
 if(!orphan)return{alreadyApplied:true};
 if(!core.provider.name.startsWith('rtdb'))throw Error('Reconciliation requires a proven provider absence contract');
 if(await core.provider.inspect(orphan.key)!==null)return{released:false,reason:'OLD_BYTES_STILL_PRESENT'};
 return core.db.transaction(async tx=>{const current=(await tx.get(core.meterPath()))?.data,o=current?.orphans?.[operation];if(!o)return{alreadyApplied:true};
  const orphans={...current.orphans};delete orphans[operation];if(current.pending<o.bytes||current.tenants[o.tenant]<o.bytes)throw Error('Inconsistent recovery accounting');
  tx.set(core.meterPath(),{pending:current.pending-o.bytes,tenants:{...current.tenants,[o.tenant]:current.tenants[o.tenant]-o.bytes},orphans,orphanReconciliationRequired:Object.keys(orphans).length>0},['pending','tenants','orphans','orphanReconciliationRequired']);return{released:true,bytes:o.bytes};
 });
}
