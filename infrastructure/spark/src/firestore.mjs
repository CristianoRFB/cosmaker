import { fail, Fault } from './core.mjs';
export const encode = (v) => {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number' && Number.isFinite(v)) return Number.isSafeInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (v && typeof v === 'object') return { mapValue: { fields: fields(v) } };
  fail('invalid-argument', 'Valor Firestore não suportado.');
};
export const fields = (value) => Object.fromEntries(Object.entries(value).map(([k,v]) => [k,encode(v)]));
export const decode = (v) => {
  if ('nullValue' in v) return null;
  if ('integerValue' in v) { const n=Number(v.integerValue); if (!Number.isSafeInteger(n)) fail('failed-precondition','Inteiro fora do contrato.'); return n; }
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('mapValue' in v) return data(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  fail('failed-precondition', 'Tipo Firestore exige adaptação explícita.');
};
export const data = (f) => Object.fromEntries(Object.entries(f).map(([k,v]) => [k,decode(v)]));
export class Firestore {
  constructor(config,budget) {
    this.config=config; this.budget=budget;
    this.prefix=`projects/${config.project}/databases/(default)/documents`;
    this.base=`${config.FIRESTORE_ORIGIN}/v1/${this.prefix}`;
  }
  name(path) {
    if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)+$/.test(path) || path.split('/').length%2) fail('invalid-argument','Caminho inválido.');
    return `${this.prefix}/${path}`;
  }
  async request(suffix, body, method='POST', missing=false) {
    const r=await this.budget.fetch(this.base+suffix,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'}, ...(body===undefined?{}:{body:JSON.stringify(body)})});
    if (missing && r.status===404) return null;
    const j=await r.json();
    if (!r.ok) throw new Fault(j.error?.status==='ABORTED'?'aborted':'unavailable','Firestore recusou a operação.',r.status===409?409:503);
    return j;
  }
  async get(path,transaction) {
    this.name(path);
    // Official batchGet body carries the transaction bytes. Emulator GET query bytes parsing is broken.
    const response=transaction?await this.request(':batchGet',{documents:[this.name(path)],transaction}):null;
    const j=transaction?response.find(v=>v.found)?.found:await this.request('/'+path,undefined,'GET',true);
    return j?{path,name:j.name,version:j.updateTime,data:data(j.fields||{})}:null;
  }
  write(path,value,create=false,mask) { return {update:{name:this.name(path),fields:fields(value)}, ...(mask?{updateMask:{fieldPaths:mask}}:{}), ...(create?{currentDocument:{exists:false}}:{})}; }
  async transaction(callback) {
    for(let attempt=0;attempt<3;attempt++) {
      const {transaction}=await this.request(':beginTransaction',{options:{readWrite:{}}});
      const writes=[];
      try {
        const result=await callback({get:p=>this.get(p,transaction),create:(p,v)=>writes.push(this.write(p,v,true)),set:(p,v,mask)=>writes.push(this.write(p,v,false,mask))});
        await this.request(':commit',{transaction,writes}); return result;
      } catch(e) {
        // Rollback also consumes budget; never retry a business refusal or a partial cross-service operation here.
        try { await this.request(':rollback',{transaction}); } catch { /* transaction expires server-side */ }
        if(e.code!=='aborted'||attempt===2) throw e;
        await new Promise(r=>setTimeout(r,10*(attempt+1)));
      }
    }
  }
  async query(query) { return (await this.request(':runQuery',{structuredQuery:query})).filter(r=>r.document).map(r=>({name:r.document.name,data:data(r.document.fields||{})})); }
}
export function permission(member, scope) { return member?.active===true && (['owner','admin'].includes(member.role)||(Array.isArray(member.permissions)&&member.permissions.includes(scope))); }
export async function actor(db,uid,scope,tx=db) {
  const profile=(await tx.get(`users/${uid}`))?.data;
  const tenant=profile?.atelierId;
  if(profile?.active!==true||profile.accountType!=='atelier_member'||typeof tenant!=='string'||!/^[A-Za-z0-9_-]{1,150}$/.test(tenant)) fail('permission-denied','Vínculo indisponível.',403);
  const atelier=(await tx.get(`ateliers/${tenant}`))?.data;
  const member=(await tx.get(`ateliers/${tenant}/members/${uid}`))?.data;
  if(atelier?.active!==true||!permission(member,scope)) fail('permission-denied','Permissão indisponível.',403);
  return {tenant,atelier,member};
}
