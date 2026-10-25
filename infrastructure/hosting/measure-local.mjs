import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
// Read-only localhost probe. These are Linux process CPU/RSS approximations, never edge billing/heap.
if(process.platform!=='linux') throw Error('Linux process instrumentation only');
const root=fileURLToPath(new URL('../../',import.meta.url));
const pids=[];
for(const name of (await readdir('/proc')).filter(n=>/^\d+$/.test(n)))try{
 const cmd=await readFile('/proc/'+name+'/cmdline','utf8');
 if(cmd.startsWith(root+'infrastructure/hosting/node_modules/@cloudflare/workerd-linux-64/bin/workerd\0serve'))pids.push(name);
}catch{}
if(pids.length!==2)throw Error('Expected exactly two owned OpenNext workerd processes');
async function stats(){let ticks=0,rss=0;for(const pid of pids){const raw=await readFile('/proc/'+pid+'/stat','utf8'),v=raw.slice(raw.lastIndexOf(')')+2).split(' ');ticks+=Number(v[11])+Number(v[12]);rss+=Number(v[21])*4096;}return{ticks,rss};}
const rows=[];
for(const path of ['/','/login','/api/spark-proof/lab']){
 const warm=await fetch('http://127.0.0.1:8788'+path,{redirect:'manual'});await warm.arrayBuffer();if(warm.status!==200)throw Error('Not ready: '+path);
 const before=await stats(),start=performance.now();
 for(let i=0;i<10;i++){const r=await fetch('http://127.0.0.1:8788'+path,{redirect:'manual'});await r.arrayBuffer();if(r.status!==200)throw Error('Preview failed');}
 const after=await stats();rows.push({path,requests:10,wallMs:performance.now()-start,processCpuMs:(after.ticks-before.ticks)*10,processCpuMsPerRequest:(after.ticks-before.ticks),aggregateProcessRssBytes:after.rss});
}
const result={kind:'LOCAL_TWO_PROCESS_CPU_PROXY_NOT_EDGE_BILLABLE_CPU',workerFreeCpuMs:10,tickMs:10,rows};
await mkdir('.local/spark',{recursive:true});await writeFile('.local/spark/hosting-resources.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
