import {DAY,updateActivity} from './policy.mjs';
import {MediaFault} from './coordinator.mjs';
// At most two fixed 30-day windows per invocation; no invented records for inactive tenants.
export async function closeActivityWindows(core,tenant){
 const path=`ateliers/${tenant}/mediaActivityV7/current`;
 for(let count=0;count<2;count++){
  const snapshot=await core.db.get(path),a=snapshot?.data;
  if(!a)return null;
  const start=Date.parse(a.lastClosedEnd||a.windowStartAt||'');
  if(!Number.isFinite(start)||start+30*DAY>core.now())return a;
  const end=start+30*DAY;
  const facts=await core.db.query({from:[{collectionId:'mediaUploadFactsV7',allDescendants:true}],where:{compositeFilter:{op:'AND',filters:[{fieldFilter:{field:{fieldPath:'atelierId'},op:'EQUAL',value:{stringValue:tenant}}},{fieldFilter:{field:{fieldPath:'recordedAt'},op:'GREATER_THAN_OR_EQUAL',value:{timestampValue:new Date(start).toISOString()}}},{fieldFilter:{field:{fieldPath:'recordedAt'},op:'LESS_THAN',value:{timestampValue:new Date(end).toISOString()}}}]}},limit:30});
  if(facts.some(f=>!Number.isSafeInteger(f.data.size)||f.data.size<1))throw Error('Invalid activity facts; keep previous tier');
  const window={startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString(),uploads:facts.length,bytes:facts.reduce((s,f)=>s+f.data.size,0)};
  const next=updateActivity(a,window,{closed:true});
  await core.db.transaction(async tx=>{const current=await tx.get(path);if(current?.version!==snapshot.version)throw new MediaFault('aborted','Activity changed; re-query before retry.',409);tx.set(path,next);});
 }
 return(await core.db.get(path))?.data||null;
}
