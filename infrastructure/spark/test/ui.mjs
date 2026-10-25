import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(new URL('../../../functions/package.json',import.meta.url));
if(process.env.GCLOUD_PROJECT!=='demo-cosmaker'||!['FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','FIREBASE_DATABASE_EMULATOR_HOST'].every(k=>/^127\.0\.0\.1:\d+$/.test(process.env[k]||'')))throw Error('Only local demo-cosmaker');
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getAuth}=require('firebase-admin/auth'),{getFirestore}=require('firebase-admin/firestore');
const app=initializeApp({projectId:'demo-cosmaker'},'spark-ui-fixture'),auth=getAuth(app),db=getFirestore(app);
const env={MODE:'emulator',PROJECT_ID:'demo-cosmaker',AUTH_ORIGIN:'http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST,FIRESTORE_ORIGIN:'http://'+process.env.FIRESTORE_EMULATOR_HOST,DATABASE_ORIGIN:'http://'+process.env.FIREBASE_DATABASE_EMULATOR_HOST,FILE_GLOBAL_BYTES:'100000000',FILE_TENANT_BYTES:'50000000',FILE_MONTHLY_BYTES:'1000000000'};
const code=await build({entryPoints:[fileURLToPath(new URL('../src/worker.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:crypto','node:buffer']});
const mf=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port:8787,modules:true,script:code.outputFiles[0].text,compatibilityDate:'2026-10-25',compatibilityFlags:['nodejs_compat'],bindings:env}));
try {
  await mf.ready;
  const uid='spark-ui-synthetic-owner',tenant='spark-ui-synthetic';
  await auth.createUser({uid,email:'spark-ui@cosmaker.test',password:'Synthetic!Password123',emailVerified:true});
  await db.doc(`users/${uid}`).set({active:true,accountType:'atelier_member',atelierId:tenant,role:'owner',permissions:[],name:'Operador sintético'});
  await db.doc(`ateliers/${tenant}`).set({active:true,name:'Ateliê sintético'});
  await db.doc(`ateliers/${tenant}/members/${uid}`).set({active:true,role:'owner',permissions:[]});
  const code=await new Promise(resolve=>{const child=spawn(process.execPath,[root+'node_modules/@playwright/test/cli.js','test','tests/e2e/spark-proof.spec.ts','--max-failures=1'],{cwd:root,stdio:'inherit',env:{...process.env,E2E_BASE_URL:'http://127.0.0.1:8788',COSMAKER_SPARK_UI:'true'}});child.on('exit',resolve);});
  if(code!==0)throw Error('Spark UI test failed');
  const entries=await db.collection(`ateliers/${tenant}/financeEntries`).get();if(entries.size!==4||entries.docs.some(d=>d.get('amountCents')!==1234))throw Error('UI did not persist four canonical ledger entries');
  const audits=await db.collection('auditLogs').where('atelierId','==',tenant).get();if(audits.size!==4)throw Error('UI did not persist four unique audits');
  console.log('SPARK_UI_PERSISTENCE_PASS: four viewports -> four canonical ledger entries and audits');

  const customer=await auth.createUser({email:'spark-ui-client@cosmaker.test',password:'Synthetic!Password123',emailVerified:true});
  await db.doc(`users/${customer.uid}`).set({active:true,accountType:'client'});
  await db.doc(`ateliers/${tenant}/orders/order-ui`).set({atelierId:tenant,status:'confirmed',clientUserId:customer.uid});
  async function loginToken(email){const r=await fetch(env.AUTH_ORIGIN+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'Synthetic!Password123',returnSecureToken:true})});if(!r.ok)throw Error('Synthetic sign-in failed');return (await r.json()).idToken;}
  const ownerToken=await loginToken('spark-ui@cosmaker.test'),clientToken=await loginToken('spark-ui-client@cosmaker.test');
  const pdf=Buffer.from('%PDF-1.7\nSYNTHETIC PROXY DOCUMENT\n%%EOF'),sha=createHash('sha256').update(pdf).digest('hex');
  async function send(key,shared){const r=await fetch(`http://127.0.0.1:8788/api/spark-proof/files/${tenant}/order-ui`,{method:'POST',headers:{Authorization:'Bearer '+ownerToken,'Content-Type':'application/pdf','x-content-sha256':sha,'x-request-id':key,'x-visible-to-client':String(shared)},body:pdf});return{status:r.status,value:await r.json()};}
  async function get(fileId,token){return fetch(`http://127.0.0.1:8788/api/spark-proof/files/${tenant}/order-ui/${fileId}`,{headers:{Authorization:'Bearer '+token}});}
  const key=randomUUID(),privateFile=await send(key,false);if(privateFile.status!==200)throw Error('Private proxy upload failed');
  if((await get(privateFile.value.data.fileId,clientToken)).status!==403)throw Error('Private file exposed through proxy');
  const ownerBytes=await get(privateFile.value.data.fileId,ownerToken);if(ownerBytes.status!==200||createHash('sha256').update(Buffer.from(await ownerBytes.arrayBuffer())).digest('hex')!==sha)throw Error('Owner proxy bytes invalid');
  if((await send(key,true)).value.error?.status!=='FAILED_PRECONDITION')throw Error('Sharing header/fingerprint did not cross Next proxy');
  const shared=await send(randomUUID(),true);if(shared.status!==200)throw Error('Explicit sharing proxy upload failed');
  const clientBytes=await get(shared.value.data.fileId,clientToken);if(clientBytes.status!==200||createHash('sha256').update(Buffer.from(await clientBytes.arrayBuffer())).digest('hex')!==sha)throw Error('Authorized proxy bytes invalid');
  console.log('SPARK_UI_PRIVATE_PROXY_PASS: staff-only/shared ACL, immutable fingerprint and SHA-256 through Next/OpenNext -> Worker -> RTDB');

}finally{await mf.dispose();await deleteApp(app);}
