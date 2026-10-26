import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simulate,physicalBytes,boundedEnvelope,finiteGrowth,p95,MAX_BYTES} from '../src/capacity.mjs';
const MiB=1024*1024;
test('exact binary and RTDB accounting includes padding, chunks and manifest overhead',()=>{
 assert.equal(MAX_BYTES,20971520);assert.equal(physicalBytes(MAX_BYTES),20971520);assert.equal(physicalBytes(MAX_BYTES,'rtdb'),28007084);
 assert.throws(()=>physicalBytes(MAX_BYTES+1));assert.equal(p95([1,5,2,3,4]),5);
});
test('zero photos creates no artificial activity, bytes or expiry',()=>{
 const r=simulate({photosPerDay:0,tenants:20});assert.equal(r.last.occupied,0);assert.equal(r.activeTenantRecords,0);assert.equal(r.deleted,0);
});
test('counterfactual reproduces pre-retention exhaustion; guarded admission preserves quota and originals',()=>{
 const input={tenants:1,photosPerDay:2,days:60,backupCopies:0,workflowDays:0};
 const demand=simulate(input),guard=simulate(input,{guarded:true});assert.equal(demand.deleted>0,true);assert.equal(demand.firstStorageBlockDay,19);
 assert.ok(guard.rejected>0);assert.ok(guard.peakOccupiedBytes<800000000);assert.ok(guard.warningDay<=guard.firstStorageBlockDay);
});
test('MEDIUM promises, notification failure, legal holds and protected/unknown domains never delete prematurely',()=>{
 const input={days:140,photosPerDay:1,sizes:[MiB],capacity:100000000000,workflowDays:0,backupCopies:0};
 const medium=simulate(input);assert.ok(medium.deleted>0);
 for(const patch of[{failNotices:true},{holdEvery:1},{protectedEvery:1},{persistentEvery:1},{unknownEvery:1}])assert.equal(simulate({...input,...patch}).deleted,0);
 assert.equal(simulate({...input,days:104,failNotices:true}).noticeFailures>0,true);
});
test('hidden versions, previews, backups, pending reservations and orphans occupy distinct byte ledgers',()=>{
 const r=simulate({days:1,photosPerDay:2,sizes:[MiB],versionEvery:1,previewBytes:65536,orphanEvery:2,initialPendingPerTenant:1});
 const x=r.last;assert.equal(x.originals,MiB);assert.equal(x.hiddenVersions,MiB);assert.equal(x.previews,65536);assert.equal(x.backupsSameQuota,2*MiB+65536);assert.equal(x.pendingReservations,MAX_BYTES);assert.equal(x.orphanReservations,4*MiB+131072);
 assert.equal(x.occupied,x.originals+x.hiddenVersions+x.previews+x.backupsSameQuota+x.orphanReservations+x.pendingReservations);
});
test('deleting a current name does not free hidden versions unless version purge is explicitly modeled',()=>{
 const o={days:150,photosPerDay:2,capacity:100000000000,workflowDays:0,backupCopies:0,versionEvery:1,suppressFutureUploadsAfterDay:15};
 const retained=simulate(o),purged=simulate({...o,purgeVersions:true});assert.ok(retained.last.hiddenVersions>0);assert.ok(purged.last.hiddenVersions<retained.last.hiddenVersions);assert.equal(retained.last.originals,purged.last.originals);
});
test('fractional LOW permanent activity, growth, decimal capacities and partial-month B2 exposure are explicit',()=>{
 const low=simulate({days:60,photosPerDay:1,rateDenominator:30,sizes:[MiB],workflowDays:0});assert.equal(low.accepted,2);assert.equal(low.deleted,0);
 const growing=simulate({days:60,photosPerDay:1,growthBpsPer30Days:10000,backupCopies:0});assert.equal(growing.accepted,90);
 const r=simulate({days:1,photosPerDay:1,downloadsPerUpload:10,backupCopies:0});const month=Object.values(r.months)[0];assert.equal(month.calendarDays,31);assert.equal(month.partialMonth,true);assert.ok(month.b2OverageExposureBytes>0);
});
test('egress guard blocks further delivery without deleting data; bounded envelope is never unbounded growth',()=>{
 const r=simulate({days:2,photosPerDay:1,monthlyEgress:1},{guarded:true});assert.ok(r.last.originals>0);assert.equal(r.firstEgressBlockDay,0);assert.equal(r.deleted,0);
 assert.ok(boundedEnvelope({capacity:10000000000,tenants:20}).filesPerTenantPerDayUpperBound<1);
 assert.equal(finiteGrowth({capacity:100,permanentBytesPerDay:1}).daysUntilFull,100);assert.equal(finiteGrowth({capacity:100,permanentBytesPerDay:0}).daysUntilFull,null);
});
