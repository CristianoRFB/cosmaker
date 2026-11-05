/** Manual onboarding: read-only unless explicitly authorized. No billing, deploy, passwords or publication. */
import { createRequire } from 'node:module';
import { parseArguments,validateArguments,validateEnvironment,validateIdentities,decideExisting }
  from './lib/tenant-onboarding-contract.mjs';

async function main() {
  const values=validateArguments(parseArguments(process.argv.slice(2)));
  const emulator=validateEnvironment(values,process.env);
  const requireFunctions=createRequire(new URL('../functions/package.json',import.meta.url));
  const {initializeApp,deleteApp}=requireFunctions('firebase-admin/app');
  const {getAuth}=requireFunctions('firebase-admin/auth');
  const {getFirestore,FieldValue}=requireFunctions('firebase-admin/firestore');
  const app=initializeApp({projectId:values.projectId},'tenant-onboarding-cli');
  try {
    const auth=getAuth(app), db=getFirestore(app);
    const [owner,operator,operatorProfile]=await Promise.all([
      auth.getUser(values.ownerUid),
      auth.getUser(values.operatorUid),
      db.doc('users/'+values.operatorUid).get()
    ]);
    validateIdentities(owner,operator,operatorProfile.data(),values);
    const slugRef=db.doc('publicAtelierSlugs/'+values.slug);
    const ownerRef=db.doc('users/'+values.ownerUid);
    const [slugSnap,profileSnap]=await Promise.all([slugRef.get(),ownerRef.get()]);
    const mapped=slugSnap.data();
    const existing=mapped ? (await db.doc('ateliers/'+mapped.atelierId).get()).data() : null;
    const publicData=mapped ? (await db.doc('publicAteliers/'+mapped.atelierId).get()).data() : null;
    if (mapped && !publicData) throw new Error('Configuração pública ausente para tenant existente.');
    if (mapped && (publicData.businessType || 'cosmaker') !== values.businessType) throw new Error('O tipo do tenant existente não corresponde ao solicitado.');
    const state=decideExisting(mapped,existing,profileSnap.data(),values);
    const report={mode:values.mode,emulator,projectId:values.projectId,
      slug:values.slug,state,publicPublished:publicData?.published===true,
      publicIntake:publicData?.quoteRequestsEnabled===true,
      deployPerformed:false,subscriptionBillingEnabled:false,
      next:['Atribuir plano manualmente','Homologar dados e permissões',
        'Aprovar custos de Functions/Storage','Autorizar publicação separada']};
    if (values.mode==='preflight' || state==='already_provisioned') {
      console.log(JSON.stringify(report,null,2)); return;
    }
    const atelierRef=db.collection('ateliers').doc();
    const publicRef=db.doc('publicAteliers/'+atelierRef.id);
    const memberRef=atelierRef.collection('members').doc(values.ownerUid);
    const configRef=atelierRef.collection('commercial').doc('config');
    const auditRef=db.collection('auditLogs').doc();
    await db.runTransaction(async(tx)=>{
      const [s,p,op]=await Promise.all([
        tx.get(slugRef),tx.get(ownerRef),tx.get(db.doc('users/'+values.operatorUid))
      ]);
      if (s.exists || p.exists) throw new Error('Concorrência: perfil ou slug mudou, reexecute preflight.');
      if (op.data()?.active!==true || op.data()?.accountType!=='platform_admin')
        throw new Error('Platform Owner não está mais ativo.');
      const now=FieldValue.serverTimestamp();
      tx.create(atelierRef,{id:atelierRef.id,name:values.name,ownerId:values.ownerUid,
        active:true,demoWorkspace:false,createdAt:now,updatedAt:now});
      tx.create(ownerRef,{id:values.ownerUid,name:owner.displayName || values.name,
        email:values.email,accountType:'atelier_member',atelierId:atelierRef.id,
        role:'owner',permissions:[],active:true,createdAt:now,updatedAt:now});
      tx.create(memberRef,{userId:values.ownerUid,role:'owner',permissions:[],
        active:true,createdAt:now,updatedAt:now});
      tx.create(slugRef,{slug:values.slug,atelierId:atelierRef.id,createdAt:now,updatedAt:now});
      tx.create(publicRef,{name:values.name,slug:values.slug,tagline:values.tagline,
        brandColor:values.brandColor,businessType:values.businessType,published:false,quoteRequestsEnabled:false,
        demoWorkspace:false,createdAt:now,updatedAt:now});
      tx.create(configRef,{featureConfig:{},createdAt:now});
      tx.create(auditRef,{actorId:values.operatorUid,atelierId:atelierRef.id,
        action:'platform.tenant_onboarding_created',entity:'atelier',entityId:atelierRef.id,
        before:null,after:{slug:values.slug,published:false,quoteRequestsEnabled:false},
        reason:'Onboarding manual; publicação pendente',timestamp:now});
    });
    console.log(JSON.stringify({...report,state:'created_unpublished',atelierId:atelierRef.id},null,2));
  } finally {await deleteApp(app);}
}
main().catch((error)=>{
  const message=error instanceof Error?error.message:'Erro desconhecido';
  console.error('Onboarding interrompido: '+message);
  process.exitCode=1;
});
