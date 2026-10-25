import {randomUUID} from 'node:crypto';
// Local synthetic broker job; production deployment and Free CPU are deliberately unaccepted.
export async function retentionSweep(core,{scheduledTime=core.now(),pageSize=16}={}){
 if(!Number.isSafeInteger(scheduledTime)||Math.abs(core.now()-scheduledTime)>60000||!Number.isInteger(pageSize)||pageSize<1||pageSize>32)throw Error('UTC schedule or bounded page invalid');
 const control='platformRuntime/mediaRetentionV7',leaseId=randomUUID();
 const lease=await core.db.transaction(async tx=>{
  const old=(await tx.get(control))?.data;
  if(old?.leaseUntil instanceof Date&&old.leaseUntil.getTime()>core.now())return null;
  // Cursor survives midnight: legacy records cannot starve valid records each new day.
  tx.set(control,{cursor:old?.cursor||null,leaseId,leaseUntil:new Date(core.now()+60000),mode:'DRY_RUN'});
  return{cursor:old?.cursor||null};
 });
 if(!lease)return{leased:true,mode:'DRY_RUN'};
 const query={from:[{collectionId:'mediaAssetsV7',allDescendants:true}],orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:pageSize};
 if(lease.cursor)query.startAt={before:false,values:[{referenceValue:lease.cursor}]};
 const page=await core.db.query(query);let evaluated=0,eligible=0,invalid=0,last=lease.cursor;
 for(const item of page){
  const current=(await core.db.get(control))?.data;
  if(current?.leaseId!==leaseId||current.leaseUntil.getTime()<=core.now())throw Error('Sweep lease lost; retry keeps prior cursor');
  const path=item.name.slice(core.db.prefix.length+1),parts=path.split('/');
  if(parts.length!==4||parts[0]!=='ateliers'||parts[2]!=='mediaAssetsV7'||!/^[A-Za-z0-9_-]{1,150}$/.test(parts[1])||!/^[a-f0-9]{64}$/.test(parts[3])||item.data.atelierId!==parts[1]||item.data.synthetic!==true||item.data.provider!==core.provider.name){invalid++;last=item.name;continue;}
  const activity=(await core.db.get(`ateliers/${parts[1]}/mediaActivityV7/current`))?.data;
  const decision=await core.evaluateRetention(parts[1],parts[3],activity?.tier||'NONE');evaluated++;eligible+=Number(decision.eligible===true);last=item.name;
 }
 await core.db.transaction(async tx=>{const c=(await tx.get(control))?.data;if(c?.leaseId!==leaseId||c.leaseUntil.getTime()<=core.now())throw Error('Sweep completion lease lost');tx.set(control,{cursor:page.length===0?null:last,leaseId:null,leaseUntil:new Date(0),updatedAt:new Date(core.now()),mode:'DRY_RUN'});});
 return{mode:'DRY_RUN',scanned:page.length,evaluated,eligible,invalid,cursor:last};
}
