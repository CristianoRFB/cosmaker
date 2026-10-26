import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {simulate,boundedEnvelope,MAX_BYTES} from './src/capacity.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=root+'docs/implementation/capacity-free/';
const providers=JSON.parse(await readFile(output+'PROVIDERS.json','utf8')).providers.filter(p=>p.capacityBytes);
const scenarios=[];
for(const provider of providers)for(const tenants of[1,5,20])for(const photosPerDay of[0,1,2,5])for(const mix of['20MiB','business-mix']){
 const options={capacity:provider.capacityBytes,monthlyEgress:provider.monthlyEgressBytes,encoding:provider.encoding,tenants,photosPerDay,
  ...(mix==='business-mix'?{sizes:[1048576,2*1048576,4*1048576,8*1048576,MAX_BYTES],previewBytes:65536,versionEvery:10,protectedEvery:20,persistentEvery:25,holdEvery:40,unknownEvery:50,fixedBytesPerTenant:1048576}:{}),days:180};
 scenarios.push({id:`${provider.id}-${tenants}-${photosPerDay}-${mix}`,provider:provider.id,mix,
  demand:simulate(options),guarded:simulate(options,{guarded:true}),envelope:boundedEnvelope({capacity:provider.capacityBytes,tenants,meanBytes:MAX_BYTES,pendingBytes:tenants*MAX_BYTES*2})});
}
for(const variant of[{id:'orphans',orphanEvery:20},{id:'notice-failure',failNotices:true},{id:'all-held',holdEvery:1},{id:'permanent',persistentEvery:1},{id:'growth',growthBpsPer30Days:2000}]){
 const {id,...patch}=variant;const options={capacity:10000000000,tenants:20,photosPerDay:1,days:365,...patch};
 scenarios.push({id:'b2-hypothetical-stress-'+id,provider:'b2',mix:'stress',demand:simulate(options),guarded:simulate(options,{guarded:true})});
}
await mkdir(output,{recursive:true});
const compact = result => { const {tierChanges,months,...rest}=result; const changes={}; for(const t of tierChanges){const key=t.day+':'+t.tier;changes[key]=(changes[key]||0)+1;} return {...rest,tierChangesByDayAndTier:changes,months:Object.fromEntries(Object.entries(months).map(([id,m])=>[id,{egressEstimate:m.egressEstimate,requestedEgress:m.requestedEgress,blockedReads:m.blockedReads,averageStoredBytes:m.averageStoredBytes,b2HypotheticalFreeEgress:m.b2HypotheticalFreeEgress,b2OverageExposureBytes:m.b2OverageExposureBytes,observedDays:m.days,calendarDays:m.calendarDays,partialMonth:m.partialMonth}]))}; };
await writeFile(output+'SCENARIOS.json',JSON.stringify({schemaVersion:1,model:'SYNTHETIC_FORECAST_NOT_PROVIDER_TELEMETRY',noRealWrites:true,
 method:'Exact integer bytes; deterministic patterns, explicit assumptions, independent demand/guard runs. p95 is nearest-rank daily forecast occupancy, not statistical confidence. Partial-month B2 allowance divides by full calendar days with zero prior/future usage. No combining accounts/quotas.',scenarioCount:scenarios.length,scenarios:scenarios.map(s=>({...s,demand:compact(s.demand),guarded:compact(s.guarded)}))})+'\n');
const rows=['scenario,capacity_bytes,tenants,photos_per_day,required_p95_bytes,required_peak_bytes,first_guard_block_day,admitted,rejected,guarded_p95_bytes,first_egress_block_day'];
for(const s of scenarios)rows.push([s.id,s.demand.options.capacity,s.demand.options.tenants,s.demand.options.photosPerDay,s.demand.p95OccupiedBytes,s.demand.peakOccupiedBytes,s.guarded.firstStorageBlockDay??'',s.guarded.accepted,s.guarded.rejected,s.guarded.p95OccupiedBytes,s.guarded.firstEgressBlockDay??''].join(','));
await writeFile(output+'SCENARIOS.csv',rows.join('\n')+'\n');console.log(`CAPACITY_MODEL: ${scenarios.length} scenarios, no provider access or deletes.`);
