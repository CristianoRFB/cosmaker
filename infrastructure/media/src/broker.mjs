import {createServer} from 'node:http';
import {identity} from '../../spark/src/identity.mjs';
import {Budget,localConfig} from '../../spark/src/core.mjs';
import {equalSecret,PART_BYTES} from './storage.mjs';
import {MediaFault} from './coordinator.mjs';
import {retentionSweep} from './retention-job.mjs';
export async function startBroker({core,env,cronSecret,port=0}){
 const config=localConfig(env);
 if(env.COSMAKER_MEDIA_PROOF!=='true'||!cronSecret||cronSecret.length<32)throw Error('Media proof flag OFF or no private cron secret');
 const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  try{
   const url=new URL(req.url,'http://127.0.0.1');if(url.search)throw new MediaFault('invalid-argument','Query não aceita.');
   const parts=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>PART_BYTES)throw new MediaFault('resource-exhausted','Bloco excede 512 KiB.',413);parts.push(chunk);}const body=Buffer.concat(parts);
   const json=()=>{try{return JSON.parse(body.toString());}catch{throw new MediaFault('invalid-argument','JSON inválido.');}};
   if(url.pathname==='/internal/retention-dry-run'){
    if(req.method!=='POST'||!equalSecret(req.headers.authorization,'Bearer '+cronSecret))throw new MediaFault('permission-denied','Acesso indisponível.',403);
    const v=json();if(Object.keys(v).some(k=>k!=='scheduledTime'))throw new MediaFault('invalid-argument','Campos inválidos.');
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await retentionSweep(core,v)));return;
   }
   const who=await identity(new Request('http://127.0.0.1'+url.pathname,{headers:{authorization:req.headers.authorization||''}}),config,new Budget());
   let result;
   if(url.pathname==='/assets'&&req.method==='GET'){
    const actor=await core.staff(who.uid),rows=await core.db.query({from:[{collectionId:'mediaAssetsV7',allDescendants:true}],where:{fieldFilter:{field:{fieldPath:'atelierId'},op:'EQUAL',value:{stringValue:actor.tenant}}},limit:32});
    result=[];for(const row of rows){if(row.data.state==='READY'&&row.data.provider===core.provider.name)result.push({tenant:actor.tenant,...await core.getView(who,actor.tenant,row.data.id)});}
   }else if(url.pathname==='/assets'&&req.method==='POST'){
    const r=await core.create(who,json());result={id:r.asset.id,tenant:r.asset.atelierId,fence:r.asset.leaseFence,state:r.asset.state,upload:r.upload||null};
   }else if(url.pathname==='/governance'&&['GET','POST'].includes(req.method)){
    const p=(await core.db.get('users/'+who.uid))?.data;
    if(p?.active!==true||!(who.claims.platformAdmin===true||p.accountType==='platform_admin'))throw new MediaFault('permission-denied','Acesso global indisponível.',403);
    if(req.method==='POST'){
     const v=json();if(Object.keys(v).length!==1||typeof v.uploadsPaused!=='boolean')throw new MediaFault('invalid-argument','Somente pausa de novos uploads.');
     await core.db.transaction(async tx=>{const current=(await tx.get('users/'+who.uid))?.data;if(current?.active!==true||!(who.claims.platformAdmin===true||current.accountType==='platform_admin'))throw new MediaFault('permission-denied','Permissão revogada.',403);tx.set('platformRuntime/mediaGovernanceV7',{uploadsPaused:v.uploadsPaused,updatedAt:new Date(core.now()),actorUid:who.uid});tx.create('auditLogs/'+crypto.randomUUID(),{actorId:who.uid,action:'media.governance_paused',after:v,timestamp:new Date(core.now())});});
    }
    result={policyVersion:'cosmaker-media-v01-gvii',mode:'DRY_RUN',cutover:false,settings:(await core.db.get('platformRuntime/mediaGovernanceV7'))?.data||{uploadsPaused:false},meter:(await core.db.get(core.meterPath()))?.data||null,billableTelemetry:'NOT_AVAILABLE_LOCAL_ESTIMATES_ONLY'};
   }else{
    const match=url.pathname.match(/^\/assets\/([A-Za-z0-9_-]{1,150})\/([a-f0-9]{64})(?:\/(view|download|part|complete|protect|revoke))?$/);
    if(!match)throw new MediaFault('not-found','Rota indisponível.',404);
    const[,tenant,id,action='view']=match;
    if(action==='view'&&req.method==='GET')result=await core.getView(who,tenant,id);
    else if(action==='download'&&req.method==='GET'){
     const r=await core.read(who,tenant,id);res.setHeader('Content-Type',r.asset.mime);res.setHeader('Content-Disposition','attachment; filename="'+id+'.'+({'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[r.asset.mime]||'bin')+'"');res.setHeader('X-Content-SHA256',r.asset.sha256);res.end(r.bytes);return;
    }else if(action==='part'&&req.method==='POST')result=await core.putPart(who,tenant,id,Number(req.headers['x-media-fence']),Number(req.headers['x-media-part']),body);
    else if(action==='complete'&&req.method==='POST'){const v=json();if(Object.keys(v).length!==1||!Number.isSafeInteger(v.fence))throw new MediaFault('invalid-argument','Fence inválido.');const r=await core.complete(who,tenant,id,v.fence);result={state:r.asset.state,alreadyApplied:r.alreadyApplied};}
    else if(action==='protect'&&req.method==='POST'){const v=json();if(Object.keys(v).some(k=>!['legalHold','extendUntil'].includes(k)))throw new MediaFault('invalid-argument','Campos inválidos.');result=await core.protect(who,tenant,id,v);}
    else if(action==='revoke'&&req.method==='POST')result=await core.revoke(who,tenant,id);
    else throw new MediaFault('not-found','Rota indisponível.',404);
   }
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:result}));
  }catch(e){res.statusCode=e.status||500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:{code:e.code||'internal',message:e.code?e.message:'Operação local indisponível.'}}));}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return{origin:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}
