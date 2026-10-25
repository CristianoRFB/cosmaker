export const DAY=86400000;
export const MiB=1024*1024;
export const POLICY_VERSION='cosmaker-media-v01-gvii';
export const MEDIA_CLASSES=['TEMP_WORKFLOW','TEMP_DERIVED','PERSISTENT_BUSINESS','PROTECTED_REGULATED','UNKNOWN_LEGACY','NO_MEDIA'];
const rank={NONE:0,LOW:1,MEDIUM:2,HIGH:3};
const validTime=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export function tierOf({uploads,bytes}) {
  if(!Number.isSafeInteger(uploads)||uploads<0||!Number.isSafeInteger(bytes)||bytes<0)throw Error('Invalid usage window');
  if(uploads===0&&bytes!==0)throw Error('Bytes without uploads');
  if(uploads>=30||bytes>=200*MiB)return 'HIGH';
  if(uploads>=5||bytes>=20*MiB)return 'MEDIUM';
  return uploads>0||bytes>0?'LOW':'NONE';
}
export function updateActivity(previous,window,{closed=false}={}) {
  const observed=tierOf(window);
  if(!previous&&observed==='NONE')return null; // No artificial records for inactive tenants.
  if(!validTime(window.startAt)||!validTime(window.endAt)||Date.parse(window.endAt)-Date.parse(window.startAt)!==30*DAY)throw Error('Expected exact UTC 30-day window');
  if(previous&&!(previous.tier in rank))throw Error('Unknown previous activity tier');
  const base=previous||{tier:'NONE',belowWindows:0,lastClosedEnd:null};
  if(rank[observed]>=rank[base.tier])return {...base,tier:observed,belowWindows:0,lastClosedEnd:closed?window.endAt:base.lastClosedEnd,policyVersion:POLICY_VERSION};
  if(!closed||base.lastClosedEnd===window.endAt)return {...base};
  const consecutive=base.lastClosedEnd===window.startAt;
  const belowWindows=consecutive?base.belowWindows+1:1;
  return {...base,tier:belowWindows>=2?observed:base.tier,belowWindows:belowWindows>=2?0:belowWindows,lastClosedEnd:window.endAt,policyVersion:POLICY_VERSION};
}
// Classification is selected by the trusted domain adapter, never by a browser TTL or frequency.
export function classifyDomain({domain,mime,approvedEvidence=false}) {
  if(['branding','published_portfolio','avatar'].includes(domain))return 'PERSISTENT_BUSINESS';
  if(['contract','invoice','order_document','measurement_document'].includes(domain)||approvedEvidence)return 'PROTECTED_REGULATED';
  if(['order_reference','quote_reference','production_photo'].includes(domain)&&['image/jpeg','image/png','image/webp'].includes(mime))return 'TEMP_WORKFLOW';
  if(domain==='derived_thumbnail')return 'TEMP_DERIVED';
  return 'UNKNOWN_LEGACY';
}
export function retentionFor(asset,tier,now,previous=asset.retention) {
  const no=reason=>({policyVersion:POLICY_VERSION,activityTier:tier,noAutoDelete:true,reason,retentionStartAt:null,dueAt:null,graceUntil:null,promisedDueAt:previous?.promisedDueAt||previous?.dueAt||null,graceDays:previous?.graceDays||0,promisedGraceUntil:previous?.promisedGraceUntil||previous?.graceUntil||null});
  if(asset.mediaClass!=='TEMP_WORKFLOW')return no('DOMAIN_PROTECTED');
  if(asset.legalHold===true)return no('LEGAL_HOLD');
  if(asset.origin==='versioned_docs'||asset.key?.startsWith('docs/'))return no('VERSIONED_ASSET');
  if(!asset.links?.length||asset.links.some(l=>l.protected===true||!validTime(l.completedAt)))return no('ACTIVE_OR_UNKNOWN_LINK');
  if(!['HIGH','MEDIUM'].includes(tier))return no('LOW_OR_NONE');
  const start=Math.max(...asset.links.map(l=>Date.parse(l.completedAt)));
  if(start>now+60000)return no('CLOCK_SKEW');
  const days=tier==='HIGH'?30:90,graceDays=Math.max(tier==='HIGH'?7:14,previous?.graceDays||0);
  const priorDue=Date.parse(previous?.promisedDueAt||previous?.dueAt||'')||0;
  const priorGrace=Date.parse(previous?.promisedGraceUntil||previous?.graceUntil||'')||0;
  const due=Math.max(start+days*DAY,priorDue);
  const grace=Math.max(due+graceDays*DAY,priorGrace);
  return {policyVersion:POLICY_VERSION,activityTier:tier,noAutoDelete:false,reason:null,retentionStartAt:new Date(start).toISOString(),dueAt:new Date(due).toISOString(),promisedDueAt:new Date(due).toISOString(),graceUntil:new Date(grace).toISOString(),promisedGraceUntil:new Date(grace).toISOString(),warningAt:new Date(due-7*DAY).toISOString(),graceDays};
}
export function deletionDecision(asset,now) {
  const r=asset.retention;
  if(asset.origin==='versioned_docs'||asset.key?.startsWith('docs/')||asset.mediaClass!=='TEMP_WORKFLOW'||r?.policyVersion!==POLICY_VERSION||r?.noAutoDelete!==false||!asset.links?.length||asset.legalHold||asset.links?.some(l=>!validTime(l.completedAt)||l.protected))return {eligible:false,reason:'PROTECTED_OR_ACTIVE'};
  if(asset.state!=='READY')return {eligible:false,reason:'NOT_READY'};
  const warning=asset.notices?.warning,due=asset.notices?.due;
  if(!warning?.recordedAt||!due?.recordedAt||warning.failed||due.failed)return {eligible:false,reason:'NOTICE_NOT_RECORDED',restrictNonessentialUploads:true};
  const effective=Math.max(Date.parse(r.graceUntil),Date.parse(warning.recordedAt)+r.graceDays*DAY,Date.parse(due.recordedAt)+r.graceDays*DAY);
  if(!Number.isFinite(effective)||now<effective)return {eligible:false,reason:'WITHIN_GRACE',effectiveGraceUntil:Number.isFinite(effective)?new Date(effective).toISOString():null};
  return {eligible:true,reason:'DRY_RUN_ONLY',expectedRevision:asset.revision,effectiveGraceUntil:new Date(effective).toISOString()};
}
export function admission({active,pending,reserved=0,capacity,essential=false,noticeFailure=false}) {
  for(const v of [active,pending,reserved,capacity])if(!Number.isSafeInteger(v)||v<0)throw Error('Invalid capacity meter');
  if(capacity===0)return {allowed:false,level:'SUSPEND',ratio:1,reason:'NO_CAPACITY'};
  const used=active+pending,ratio=used/capacity,projected=(used+reserved)/capacity;
  if(ratio>=.9||projected>=.9)return {allowed:false,level:'SUSPEND',ratio,reason:'PRESERVE_EXISTING'};
  if((projected>=.8||noticeFailure)&&!essential)return {allowed:false,level:'LIMIT',ratio,reason:noticeFailure?'NOTICE_FAILURE':'NONESSENTIAL'};
  return {allowed:true,level:ratio>=.7?'ALERT':'NORMAL',ratio,reason:null};
}
export function capacityScenario({tenants,uploadsPerTenantPerDay=2,size=20*MiB,capacity=1_000_000_000,encodingRatio=1}) {
  const dailyBytes=tenants*uploadsPerTenantPerDay*size*encodingRatio;
  return {tenants,dailyBytes,daysTo90Percent:.9*capacity/dailyBytes,daysToFull:capacity/dailyBytes,earliestHighGraceDays:37,saturatesBeforeFirstExpiry:capacity/dailyBytes<37};
}
