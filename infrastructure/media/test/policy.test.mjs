import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DAY,MiB,POLICY_VERSION,tierOf,updateActivity,retentionFor,deletionDecision,admission,capacityScenario} from '../src/policy.mjs';
const now=Date.parse('2026-10-25T00:00:00Z');
const window=(uploads,bytes,start=now-30*DAY)=>({uploads,bytes,startAt:new Date(start).toISOString(),endAt:new Date(start+30*DAY).toISOString()});
const asset=(extras={})=>({mediaClass:'TEMP_WORKFLOW',key:'proof/tenant/opaque',links:[{id:'order',completedAt:'2026-01-01T00:00:00Z'}],state:'READY',revision:3,...extras});
test('exact adaptive thresholds and immediate increase; NONE creates no artificial record',()=>{
 for(const [uploads,bytes,tier] of [[0,0,'NONE'],[1,1,'LOW'],[4,20*MiB-1,'LOW'],[5,5,'MEDIUM'],[1,20*MiB,'MEDIUM'],[30,30,'HIGH'],[1,200*MiB,'HIGH']])assert.equal(tierOf({uploads,bytes}),tier);
 assert.equal(updateActivity(null,window(0,0)),null);assert.equal(updateActivity({tier:'LOW'},window(30,30)).tier,'HIGH');
 assert.throws(()=>tierOf({uploads:-1,bytes:0}));
});
test('downgrade needs two distinct completed consecutive 30-day windows, replay is inert',()=>{
 let state={tier:'HIGH',belowWindows:0,lastClosedEnd:null};
 state=updateActivity(state,window(1,1,now-90*DAY),{closed:true});assert.equal(state.tier,'HIGH');
 const retry=updateActivity(state,window(1,1,now-90*DAY),{closed:true});assert.deepEqual(retry,state);
 state=updateActivity(state,window(1,1,now-60*DAY),{closed:true});assert.equal(state.tier,'LOW');
});
test('domain, active/multiple links, unknown legacy, docs and legal hold override activity',()=>{
 for(const change of [{mediaClass:'PERSISTENT_BUSINESS'},{mediaClass:'PROTECTED_REGULATED'},{mediaClass:'UNKNOWN_LEGACY'},{mediaClass:'TEMP_DERIVED'},{legalHold:true},{key:'docs/screenshots/example.png'},{links:[]},{links:[{id:'open'}]},{links:[{completedAt:'2026-01-01'},{id:'open'}]},{links:[{completedAt:'2026-01-01',protected:true}]}])assert.equal(retentionFor(asset(change),'HIGH',now).noAutoDelete,true);
});
test('UTC closure dates, no shortening promises, LOW no-delete, viewing is irrelevant',()=>{
 const medium=retentionFor(asset(),'MEDIUM',now);assert.equal(medium.dueAt,'2026-04-01T00:00:00.000Z');assert.equal(medium.graceUntil,'2026-04-15T00:00:00.000Z');
 const high=retentionFor(asset({retention:medium}),'HIGH',now);assert.equal(high.dueAt,medium.dueAt);assert.equal(high.graceUntil,medium.graceUntil);
 assert.equal(retentionFor(asset(),'LOW',now).noAutoDelete,true);assert.deepEqual(retentionFor(asset({lastViewedAt:new Date(now).toISOString()}),'HIGH',now),retentionFor(asset(),'HIGH',now));
});
test('notices, grace and revision prevent premature deletion; planning remains dry-run',()=>{
 const value=asset();value.retention=retentionFor(value,'HIGH',now);
 assert.equal(deletionDecision(value,now).reason,'NOTICE_NOT_RECORDED');
 value.notices={warning:{recordedAt:new Date(now).toISOString()},due:{recordedAt:new Date(now).toISOString()}};
 assert.equal(deletionDecision(value,now).reason,'WITHIN_GRACE');
 assert.deepEqual(deletionDecision(value,now+8*DAY).eligible,true);assert.equal(deletionDecision(value,now+8*DAY).expectedRevision,3);
 value.legalHold=true;assert.equal(deletionDecision(value,now+8*DAY).eligible,false);
});
test('70/80/90 percent admission never deletes existing data and notices failure closes optional uploads',()=>{
 assert.equal(admission({active:70,pending:0,capacity:100}).level,'ALERT');
 assert.equal(admission({active:79,pending:1,reserved:1,capacity:100}).allowed,false);
 assert.equal(admission({active:80,pending:0,reserved:1,capacity:100,essential:true}).allowed,true);
 assert.equal(admission({active:89,pending:1,reserved:0,capacity:100,essential:true}).allowed,false);
 assert.equal(admission({active:1,pending:0,capacity:100,noticeFailure:true}).allowed,false);
});
test('1/5/20 tenants exhaust 1GB before earliest 37-day retention at 2x20MiB/day',()=>{
 for(const tenants of[1,5,20]){const s=capacityScenario({tenants});assert.equal(s.saturatesBeforeFirstExpiry,true);assert.ok(s.daysToFull<24);}
 assert.equal(POLICY_VERSION,'cosmaker-media-v01-gvii');
});
