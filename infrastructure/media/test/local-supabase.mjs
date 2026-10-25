import {spawn} from 'node:child_process';
import {randomBytes,createHmac} from 'node:crypto';
import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const nonce=randomBytes(5).toString('hex'),network='cosmaker-media-v7-'+nonce,pg=network+'-pg',storage=network+'-storage';
const dir=resolve(root,'.local/media-v7',network);
const password=randomBytes(32).toString('hex'),jwtSecret=randomBytes(48).toString('hex');
const sign=role=>{const now=Math.floor(Date.now()/1000),h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),p=Buffer.from(JSON.stringify({role,iss:'supabase',iat:now,exp:now+3600})).toString('base64url');return h+'.'+p+'.'+createHmac('sha256',jwtSecret).update(h+'.'+p).digest('base64url');};
const service=sign('service_role'),anon=sign('anon'),authenticated=sign('authenticated');
const dockerEnv={...process.env};for(const key of['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete dockerEnv[key];
async function docker(args,input){return new Promise((resolveResult,reject)=>{const child=spawn('docker',['--host=unix:///var/run/docker.sock',...args],{env:dockerEnv,stdio:['pipe','pipe','pipe']});let text='';child.stdout.on('data',v=>text+=v);child.stderr.on('data',v=>text+=v);if(input)child.stdin.end(input);else child.stdin.end();child.on('exit',code=>{if(code!==0)reject(Error(text.replaceAll(password,'[synthetic-password]').replaceAll(jwtSecret,'[synthetic-key]').replaceAll(service,'[synthetic-service-token]')));else resolveResult(text.trim());});});}
if(process.argv.includes('--stop')){
 const pointer=root+'.local/media-v7/oss-connection-path.txt';
 const connectionPath=(await readFile(pointer,'utf8')).trim();
 if(!connectionPath.startsWith(resolve(root,'.local/media-v7')+'/cosmaker-media-v7-')||!connectionPath.endsWith('/connection.json'))throw Error('Unsafe local cleanup path');
 const own=JSON.parse(await readFile(connectionPath,'utf8'));
 if(!/^cosmaker-media-v7-[a-f0-9]{10}$/.test(own.network)||own.pg!==own.network+'-pg'||own.storage!==own.network+'-storage')throw Error('Unsafe local cleanup names');
 for(const name of[own.storage,own.pg])await docker(['stop',name]);
 await docker(['network','rm',own.network]);await rm(resolve(connectionPath,'..'),{recursive:true,force:true});await rm(pointer,{force:true});
 console.log('OWN_SYNTHETIC_CONTAINERS_STOPPED');process.exit(0);
}
await mkdir(dir,{recursive:true,mode:0o700});
const cleanup=async()=>{for(const name of[storage,pg])try{await docker(['stop',name]);}catch{}try{await docker(['network','rm',network]);}catch{}await rm(dir,{recursive:true,force:true});const pointer=root+'.local/media-v7/oss-connection-path.txt';if((await readFile(pointer,'utf8').catch(()=>''))===dir+'/connection.json')await rm(pointer,{force:true});};
try{
 await docker(['info','--format','{{.ServerVersion}}']);await docker(['network','create',network]);
 await writeFile(dir+'/postgres.env','POSTGRES_PASSWORD='+password+'\nPOSTGRES_DB=postgres\n',{mode:0o600});
 await docker(['run','--rm','-d','--name',pg,'--network',network,'--env-file',dir+'/postgres.env','postgres@sha256:f4610795587492cd4fb887c2dc3de301b813278bb6f616992061141b5f15ac36']);
 for(let i=0;i<20;i++){try{await docker(['exec',pg,'pg_isready','-U','postgres']);break;}catch{if(i===19)throw Error('Local PostgreSQL not ready');await new Promise(r=>setTimeout(r,500));}}
 const lines=['SERVER_PORT=5000','SERVER_HOST=0.0.0.0','AUTH_JWT_SECRET='+jwtSecret,'AUTH_JWT_ALGORITHM=HS256','ANON_KEY='+anon,'SERVICE_KEY='+service,'DATABASE_URL=postgresql://postgres:'+password+'@'+pg+':5432/postgres','DB_INSTALL_ROLES=true','STORAGE_BACKEND=file','STORAGE_FILE_BACKEND_PATH=/tmp/cosmaker-storage','UPLOAD_FILE_SIZE_LIMIT=20971520','UPLOAD_FILE_SIZE_LIMIT_STANDARD=20971520','UPLOAD_SIGNED_URL_EXPIRATION_TIME=120','TUS_URL_PATH=/upload/resumable','TUS_URL_EXPIRY_MS=3600000','IMAGE_TRANSFORMATION_ENABLED=false','PG_QUEUE_ENABLE=false','OTEL_METRICS_ENABLED=false','PROMETHEUS_METRICS_ENABLED=false','LOG_LEVEL=error'];
 await writeFile(dir+'/storage.env',lines.join('\n')+'\n',{mode:0o600});
 const ca=process.env.CODEX_PROXY_CERT;const caArgs=ca?['--mount',`type=bind,src=${ca},dst=/run/proxy-ca.pem,readonly`,'-e','NODE_EXTRA_CA_CERTS=/run/proxy-ca.pem']:[];
 await docker(['run','--rm','-d','--name',storage,'--network',network,'--env-file',dir+'/storage.env','-p','127.0.0.1:15400:5000',...caArgs,'supabase/storage-api@sha256:7112e91307968d3eceffb5228291202d7bac8015a27af25d4b5a4b0543eadf22']);
 let ready=false;for(let i=0;i<40;i++){try{const r=await fetch('http://127.0.0.1:15400/status');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
 if(!ready){const logs=await docker(['logs','--tail','15',storage]).catch(e=>e.message);throw Error('Official local storage failed: '+logs);}
 await writeFile(dir+'/connection.json',JSON.stringify({origin:'http://127.0.0.1:15400',service,anon,authenticated,pg,storage,network,kind:'OFFICIAL_SUPABASE_STORAGE_OSS_LOCAL_NOT_HOSTED_FREE'},null,2),{mode:0o600});
 await writeFile(root+'.local/media-v7/oss-connection-path.txt',dir+'/connection.json',{mode:0o600});
 console.log('OFFICIAL_SUPABASE_OSS_LOCAL_READY: private connection file, no hosted project/billing.');
 if(process.argv.includes('--probe-only')){await cleanup();}else await new Promise(resolve=>{const timer=setInterval(()=>{},1000);for(const signal of['SIGINT','SIGTERM'])process.on(signal,async()=>{await cleanup();clearInterval(timer);resolve();});});
}catch(error){await cleanup();throw error;}
