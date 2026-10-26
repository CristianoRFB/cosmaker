// Public DevTools CPU sampling. It is NOT hosted billing CPU or a hard limit.
export async function profileInvocation(runtime, operation) {
  const origin=await runtime.getInspectorURL();if(origin.protocol==='ws:')origin.protocol='http:';
  const targets=await(await fetch(new URL('/json/list',origin))).json();
  const target=targets.find(t=>(t.title+' '+t.id+' '+t.url).includes('viii-diagnostic'));
  if(!target?.webSocketDebuggerUrl)throw Error('Own diagnostic worker inspector target missing');
  const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let seq=0;const pending=new Map();
  ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.id&&pending.has(msg.id)){const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);if(msg.error)reject(Error(msg.error.message));else resolve(msg.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  try{
    await send('Profiler.enable');await send('Profiler.setSamplingInterval',{interval:100});
    const before=await send('Runtime.getHeapUsage');await send('Profiler.start');
    const started=performance.now(),result=await operation(),wallMs=performance.now()-started;
    const {profile}=await send('Profiler.stop'),after=await send('Runtime.getHeapUsage');
    const names=new Map(profile.nodes.map(n=>[n.id,n.callFrame.functionName]));let sampledNonIdleUs=0;
    for(let n=0;n<(profile.samples||[]).length;n++)if(!['(idle)','(root)'].includes(names.get(profile.samples[n])))sampledNonIdleUs+=profile.timeDeltas?.[n]||0;
    return{result,metrics:{wallMs,devToolsNonIdleSamplingWindowMs:sampledNonIdleUs/1000,profileDurationMs:(profile.endTime-profile.startTime)/1000,
      before,after,exactInvocationCpuMs:null,hostedCpuMs:null,warning:'Samples include runtime/unknown frames; native crypto, I/O and profiler overhead prevent billing equivalence. Heap counters do not cover total isolate memory.'}};
  }finally{ws.close();}
}
