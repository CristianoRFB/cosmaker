import { localConfig, Budget, Fault, fail, only } from './core.mjs';
import { identity } from './identity.mjs';
import { Firestore, actor } from './firestore.mjs';
import { recordFinanceEntry } from './finance.mjs';
import { Database, upload, download } from './files.mjs';
import { expireQuotes } from './scheduler.mjs';
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export default {
  async fetch(req,env) {
    const budget=new Budget();
    try {
      const config=localConfig(env),db=new Firestore(config,budget),rtdb=new Database(config,budget);
      const url=new URL(req.url);
      if(url.pathname==='/health'&&req.method==='GET') return json({mode:'EMULATOR_ONLY_NOT_DEPLOYABLE',project:config.project});
      // No HTTP scheduler endpoint: only runtime scheduled events.
      if(url.pathname.includes('scheduled')||url.pathname.includes('expireQuotes')) return json({error:{status:'NOT_FOUND'}},404);
      const who=await identity(req,config,budget);
      if(url.pathname==='/getTenantWorkspace'&&req.method==='POST') {
        only(await req.json(),['data']);
        const a=await db.transaction(tx=>actor(db,who.uid,'orders:read',tx));
        return json({data:{atelierId:a.tenant,role:a.member.role}});
      }
      if(url.pathname==='/recordFinanceEntry'&&req.method==='POST') {
        const body=only(await req.json(),['data']);
        return json({data:await recordFinanceEntry(db,who,body.data)});
      }
      const route=url.pathname.match(/^\/files\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)(?:\/([A-Za-z0-9_-]+))?$/);
      if(route) {
        const params={tenant:route[1],orderId:route[2],...(route[3]?{fileId:route[3]}:{})};
        if(req.method==='POST'&&!route[3]) return json({data:await upload(req,db,rtdb,who,env,params)});
        if(req.method==='GET'&&route[3]) {
          const response=await download(db,rtdb,who,env,params);
          await identity(req,config,budget); // Recheck actual revocation after private object read.
          return response;
        }
      }
      return json({error:{status:'UNIMPLEMENTED',message:'Operação ainda não portada; sem fallback para Functions.'}},501);
    } catch(e) {
      if(!(e instanceof Fault)) console.error('spark-proof: unexpected internal error');
      return json({error:{status:(e.code||'internal').replaceAll('-','_').toUpperCase(),message:e instanceof Fault?e.message:'Falha interna.'}},e instanceof Fault?e.status:500);
    }
  },
  async scheduled(event,env,ctx) {
    const config=localConfig(env),budget=new Budget();
    ctx.waitUntil(expireQuotes(new Firestore(config,budget),event.scheduledTime));
  },
};
