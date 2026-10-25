export default {
 async fetch(){return new Response(null,{status:404});},
 async scheduled(event,env,ctx){
  const origin=new URL(env.MEDIA_BROKER_ORIGIN||'');
  if(env.MODE!=='emulator'||env.PROJECT_ID!=='demo-cosmaker'||origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||!origin.port||origin.pathname!=='/'||origin.username||origin.password||origin.search||origin.hash||!env.MEDIA_CRON_SECRET||env.MEDIA_CRON_SECRET.length<32)throw Error('Only private loopback synthetic cron');
  ctx.waitUntil((async()=>{const r=await fetch(new URL('/internal/retention-dry-run',origin),{method:'POST',headers:{Authorization:'Bearer '+env.MEDIA_CRON_SECRET,'Content-Type':'application/json'},body:JSON.stringify({scheduledTime:event.scheduledTime}),redirect:'manual'});if(!r.ok)throw Error('Dry-run job failed');})());
 }
};
