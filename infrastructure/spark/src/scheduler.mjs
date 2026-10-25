import { date } from './core.mjs';
import { encode } from './firestore.mjs';
// A bounded continuation replaces an unbounded collectionGroup loop. Not promoted to parity:
// capacity/backlog and real Free CPU still require acceptance.
export async function expireQuotes(db, scheduledTime) {
  const today=new Date(scheduledTime).toISOString().slice(0,10);
  const control='platformRuntime/sparkQuoteExpiration';
  const leaseId=crypto.randomUUID();
  const lease=await db.transaction(async tx=>{
    const old=(await tx.get(control))?.data;
    if(old?.leaseUntil instanceof Date&&old.leaseUntil.getTime()>Date.now()) return null;
    const cursor=old?.day===today?old?.cursor:null;
    tx.set(control,{day:today,cursor:cursor||null,leaseId,leaseUntil:new Date(Date.now()+60000)});
    return {cursor};
  });
  if(!lease) return {leased:true};
  const query={from:[{collectionId:'quotes',allDescendants:true}],where:{compositeFilter:{op:'AND',filters:[{fieldFilter:{field:{fieldPath:'status'},op:'EQUAL',value:encode('sent')}},{fieldFilter:{field:{fieldPath:'validUntil'},op:'LESS_THAN',value:encode(today)}}]}},orderBy:[{field:{fieldPath:'validUntil'},direction:'ASCENDING'},{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:16};
  if(lease.cursor) query.startAt={before:false,values:[encode(lease.cursor.validUntil),{referenceValue:lease.cursor.name}]};
  const page=await db.query(query);
  let processed=0,expired=0,last=null;
  for(const candidate of page) {
    const path=candidate.name.slice(db.prefix.length+1),parts=path.split('/');
    if(parts.length===4&&parts[0]==='ateliers'&&parts[2]==='quotes'&&date(candidate.data.validUntil)&&/^[A-Za-z0-9_-]{1,150}$/.test(candidate.data.requestId||'')) {
      if(processed>=2) break;
      processed++;
      expired+=await db.transaction(async tx=>{
        const quote=await tx.get(path);
        const requestPath=`ateliers/${parts[1]}/quoteRequests/${candidate.data.requestId}`;
        const request=await tx.get(requestPath);
        const q=quote?.data;
        if(!q||q.status!=='sent'||!date(q.validUntil)||q.validUntil>=today||q.requestId!==candidate.data.requestId||typeof q.total!=='number'||!Number.isFinite(q.total)||q.total<0) return 0;
        const now=new Date();
        tx.set(path,{status:'expired',expiredAt:now,updatedAt:now},['status','expiredAt','updatedAt']);
        if(request?.data.activeQuoteId===parts[3]) tx.set(requestPath,{status:'expired',updatedAt:now},['status','updatedAt']);
        tx.create(`auditLogs/${crypto.randomUUID()}`,{actorId:'system',atelierId:parts[1],action:'quote.expired',entity:'quote',entityId:parts[3],before:{status:q.status,total:q.total},after:{status:'expired',total:q.total},timestamp:now});
        return 1;
      });
    }
    last={validUntil:candidate.data.validUntil,name:candidate.name};
  }
  await db.transaction(async tx=>{
    const current=(await tx.get(control))?.data;
    if(current?.leaseId!==leaseId) return;
    tx.set(control,{day:today,cursor:page.length===0?null:last||lease.cursor||null,leaseId:null,leaseUntil:new Date(0),updatedAt:new Date()});
  });
  return {expired,scanned:page.length,processed};
}
