import {cpuUsage} from 'node:process';
import {localConfig} from '../../spark/src/core.mjs';
import {Firestore} from '../../spark/src/firestore.mjs';
import {identity} from '../../spark/src/identity.mjs';
import {MediaCoordinator} from '../../media/src/coordinator.mjs';
import {assertLocalOrigin} from '../../media/src/storage.mjs';
import {InvocationBudget,MemoryReservations,DailyLedger,BudgetFault} from './budget.mjs';
const daily = new DailyLedger(), memory = new MemoryReservations();
const MAX = 20 * 1024 * 1024;
const json = (body, status = 200) => Response.json(body, { status, headers: {'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'} });
function diagnostic(env, budget) {
  if (env.DIAGNOSTIC_UNENFORCED_CPU !== 'local-synthetic-only') budget.assertStrictCpu();
}
export default {
  async fetch(request, env) {
    const budget = new InvocationBudget(); let release;
    try {
      const config = localConfig(env), url = new URL(request.url);
      daily.charge();
      if(request.method!=='GET'||url.search)throw new BudgetFault('ROUTE_UNAVAILABLE',404);
      if(url.pathname==='/calibrate'){
        diagnostic(env,budget);
        // Bounded CPU calibration; never present as a public production route.
        let cpuCounter;try{cpuCounter={result:cpuUsage(),trustedInvocationCounter:false};}catch{cpuCounter={availability:'UNAVAILABLE_LOCAL',trustedInvocationCounter:false};}
        const start=performance.now();let n=0;for(let i=0;i<40000000;i++)n=(Math.imul(n+i,1664525)+1013904223)|0;
        return json({n,cpuCounter,workerClockDeltaMs:performance.now()-start,...budget.report()});
      }
      const match=url.pathname.match(/^\/(verify|download)\/([a-f0-9]{64})$/);
      if(!match)throw new BudgetFault('ROUTE_UNAVAILABLE',404);
      diagnostic(env,budget);
      const [,operation,id]=match, who=await identity(request,config,budget), db=new Firestore(config,budget);
      const pointer=(await db.get('mediaReferencesV8/'+id))?.data;
      if(!pointer||!/^[A-Za-z0-9_-]{1,150}$/.test(pointer.atelierId))throw new BudgetFault('ACCESS_DENIED',403);
      const core=new MediaCoordinator({db,provider:{name:'viii-http-transport-fixture',localSyntheticOnly:true},enabled:true});
      const path=core.assetPath(pointer.atelierId,id),asset=(await db.get(path))?.data;
      if(!asset||asset.synthetic!==true||asset.state!=='READY'||asset.size!==MAX||!/^[a-f0-9]{64}$/.test(asset.sha256)||await db.get('mediaTombstonesV7/'+id))throw new BudgetFault('ACCESS_DENIED',403);
      await core.access(who,pointer.atelierId,asset);
      release=memory.reserve(operation==='download'?2*MAX+1024*1024:MAX+1024*1024);
      const origin=assertLocalOrigin(env.BLOB_FIXTURE_ORIGIN);
      const response=await budget.fetch(origin+'/objects/'+id,{headers:{Authorization:'Bearer '+env.BLOB_FIXTURE_SECRET}});
      if(!response.ok||!response.body)throw new BudgetFault('PROVIDER_UNAVAILABLE',503);
      const stream=new crypto.DigestStream('SHA-256'),writer=stream.getWriter(),reader=response.body.getReader(),chunks=[];
      void stream.digest.catch(()=>{}); // Early size/network failure aborts the digest too.
      let size=0;
      try{
        for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>asset.size)throw new BudgetFault('SIZE_MISMATCH',409);await writer.write(value);if(operation==='download')chunks.push(value);}
        await writer.close();
      }catch(e){await reader.cancel().catch(()=>{});await writer.abort().catch(()=>{});throw e;}
      const digest=Array.from(new Uint8Array(await stream.digest),v=>v.toString(16).padStart(2,'0')).join('');
      if(size!==asset.size||digest!==asset.sha256)throw new BudgetFault('HASH_MISMATCH',409);
      const after=(await db.get(path))?.data;
      if(after?.state!=='READY'||after.revision!==asset.revision||await db.get('mediaTombstonesV7/'+id))throw new BudgetFault('ACCESS_DENIED',403);
      await identity(request,config,budget);await core.access(who,pointer.atelierId,after);
      const report={...budget.report(),operation,size,digest,logicalMemoryPeakReserved:memory.peak,mode:'DIAGNOSTIC_ONLY_NO_READY_COMMIT'};
      if(operation==='verify')return json(report);
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      const releaseBody=release;release=undefined;let delivered=0;
      const body=new ReadableStream({pull(controller){if(delivered>=size){releaseBody();controller.close();return;}controller.enqueue(bytes.subarray(delivered,Math.min(size,delivered+65536)));delivered+=65536;},cancel(){releaseBody();}});
      return new Response(body,{headers:{'Content-Type':asset.mime,'Content-Disposition':'attachment; filename="synthetic-original.bin"','X-Content-SHA256':digest,'X-Resource-Budget':JSON.stringify(report),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
    }catch(e){return json({error:{code:e.code||'LOCAL_PROOF_UNAVAILABLE'},budget:budget.report()},e.status||500);}
    finally{release?.();}
  },
  async scheduled(_event,env,ctx){
    localConfig(env);daily.charge();const budget=new InvocationBudget();
    // Full cron is blocked when the CPU guarantee is unavailable; no Node offload masquerading as Free.
    ctx.waitUntil(Promise.resolve().then(()=>budget.assertStrictCpu()));
  }
};
