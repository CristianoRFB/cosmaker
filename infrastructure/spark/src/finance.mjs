import { cents, financeCategories, financialOrder, sumCents } from '../../../functions/src/finance/policy.ts';
import { actor } from './firestore.mjs';
import { fail, only, id, date, sha256 } from './core.mjs';
const statuses=['confirmed','waiting_materials','scheduled','modeling','in_production','fitting','adjustments','finishing','waiting_final_payment','ready_to_ship','shipped','delivered','completed','paused'];
function text(v,min,max) { if(typeof v!=='string'||v.trim().length<min||v.trim().length>max) fail('invalid-argument','Texto inválido.'); return v.trim(); }
export async function recordFinanceEntry(db,who,value) {
  const v=only(value,['requestId','kind','basis','category','amountCents','description','effectiveDate','orderId','method','reference']);
  if(!id(v.requestId)||!['expense','income','payment'].includes(v.kind)||!['planned','actual'].includes(v.basis)||!financeCategories.includes(v.category)||!date(v.effectiveDate)||(v.orderId!=null&&!id(v.orderId))) fail('invalid-argument','Lançamento inválido.');
  const orderId=typeof v.orderId==='string'?v.orderId:null;
  if((v.kind==='income'&&orderId)||(v.kind==='payment'&&(!orderId||v.basis!=='actual'||!['pix','bank_transfer','cash','other'].includes(v.method)))||(v.kind!=='payment'&&v.method!=null)) fail('invalid-argument','Recebimento inválido.');
  let amountCents; try { amountCents=cents(v.amountCents,true); } catch { fail('invalid-argument','Use centavos inteiros seguros.'); }
  const entry={kind:v.kind,basis:v.basis,category:v.category,amountCents,description:text(v.description,3,300),effectiveDate:v.effectiveDate,orderId,method:v.kind==='payment'?v.method:null,reference:v.reference==null?null:text(v.reference,0,120)||null};
  const entryId=await sha256(JSON.stringify([who.uid,v.requestId]));
  const fingerprint=await sha256(JSON.stringify(entry));
  const referenceId=entry.reference?await sha256(JSON.stringify([orderId,entry.reference.toLowerCase()])):null;
  return db.transaction(async tx=>{
    const a=await actor(db,who.uid,'finance:write',tx);
    if(a.atelier.demoWorkspace===true) fail('failed-precondition','Demonstrações não registram financeiro.');
    const root=`ateliers/${a.tenant}`;
    const previous=await tx.get(`${root}/financeOperations/${entryId}`);
    if(previous) { if(previous.data.fingerprint!==fingerprint) fail('failed-precondition','Chave reutilizada com outros valores.'); return {entryId,alreadyApplied:true}; }
    const order=orderId?await tx.get(`${root}/orders/${orderId}`):null;
    if(orderId&&!order) fail('not-found','Pedido indisponível.',404);
    const refPath=entry.kind==='payment'&&referenceId?`${root}/financePaymentReferences/${referenceId}`:null;
    if(refPath&&await tx.get(refPath)) fail('already-exists','Referência já registrada.',409);
    const now=new Date();
    if(entry.kind==='payment') {
      if(!statuses.includes(order.data.status)) fail('failed-precondition','Pedido sem entrada confirmada.');
      let balance; try { balance=financialOrder(order.data); } catch { fail('failed-precondition','Saldo inconsistente.'); }
      if(amountCents>balance.remainingCents) fail('failed-precondition','Recebimento excede saldo.');
      const paid=sumCents(balance.receivedCents,amountCents),remaining=balance.revenueCents-paid;
      tx.set(order.path,{amountPaidCents:paid,amountPaid:paid/100,amountRemainingCents:remaining,amountRemaining:remaining/100,updatedAt:now},['amountPaidCents','amountPaid','amountRemainingCents','amountRemaining','updatedAt']);
      tx.create(`${order.path}/payments/${entryId}`,{type:amountCents===balance.remainingCents?'final':'installment',amount:amountCents/100,amountCents,status:'paid',method:entry.method,reference:entry.reference,effectiveDate:entry.effectiveDate,confirmedBy:who.uid,source:'manual_finance',financeEntryId:entryId,paidAt:now,createdAt:now,updatedAt:now});
      if(refPath) tx.create(refPath,{entryId,createdAt:now});
    }
    const stored={...entry,paymentId:entry.kind==='payment'?entryId:null,reversesEntryId:null,reason:null,createdAt:now,actorId:who.uid};
    tx.create(`${root}/financeEntries/${entryId}`,stored);
    tx.create(`${root}/financeOperations/${entryId}`,{fingerprint,entryId,createdAt:now});
    tx.create(`auditLogs/${crypto.randomUUID()}`,{actorId:who.uid,atelierId:a.tenant,action:'finance.entry_recorded',entity:'finance_entry',entityId:entryId,before:null,after:stored,timestamp:now});
    return {entryId,alreadyApplied:false};
  });
}
