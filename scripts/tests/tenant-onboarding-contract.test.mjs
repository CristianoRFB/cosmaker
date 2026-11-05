import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseArguments,validateArguments,validateEnvironment,validateIdentities,decideExisting}
 from '../lib/tenant-onboarding-contract.mjs';
const raw={mode:'preflight','project-id':'demo-cosmaker',name:'Ateliê Exemplo',
 slug:'atelie-exemplo','owner-uid':'owner-user-123','owner-email':'owner@example.test',
 'operator-uid':'operator-user-123'};
const cfg=()=>validateArguments(raw);
test('argumentos inválidos são rejeitados',()=>{
 assert.throws(()=>parseArguments(['--slug=a','--slug=b']),/duplicado/);
 assert.throws(()=>validateArguments({...raw,foo:'bar'}),/reconhecido/);
});
test('slugs reservados e incorretos são rejeitados',()=>{
 for(const slug of ['admin','api','Dogstar','x','foo/bar','foo--bar'])
   assert.throws(()=>validateArguments({...raw,slug}),/Slug/);
});
test('UID, email e cor precisam ser válidos',()=>{
 assert.throws(()=>validateArguments({...raw,'owner-email':'bad'}),/E-mail/);
 assert.throws(()=>validateArguments({...raw,'operator-uid':raw['owner-uid']}),/UIDs/);
 assert.throws(()=>validateArguments({...raw,'brand-color':'red'}),/Cor/);
});
test('não permite misturar emuladores nem escrita real sem três confirmações',()=>{
 assert.equal(validateEnvironment(cfg(),{FIRESTORE_EMULATOR_HOST:'localhost:8080',FIREBASE_AUTH_EMULATOR_HOST:'localhost:9099'}),true);
 assert.throws(()=>validateEnvironment(cfg(),{FIRESTORE_EMULATOR_HOST:'localhost:8080'}),/ambos/);
 assert.throws(()=>validateEnvironment({...cfg(),mode:'apply'},{}),/bloqueada/);
 assert.equal(validateEnvironment({...cfg(),mode:'apply',productionApply:true,
   confirmProject:'demo-cosmaker',confirmSlug:'atelie-exemplo',confirmOwnerUid:'owner-user-123'},{}),false);
});
test('identidades devem estar verificadas e Platform Owner precisa de claim',()=>{
 const owner={email:'owner@example.test',emailVerified:true,disabled:false};
 const operator={emailVerified:true,disabled:false,customClaims:{platformAdmin:true}};
 const profile={active:true,accountType:'platform_admin'};
 assert.doesNotThrow(()=>validateIdentities(owner,operator,profile,cfg()));
 assert.throws(()=>validateIdentities({...owner,emailVerified:false},operator,profile,cfg()),/Owner/);
 assert.throws(()=>validateIdentities(owner,{...operator,customClaims:{}},profile,cfg()),/Platform Owner/);
});
test('preserva perfis existentes e recusa colisão de tenant',()=>{
 assert.equal(decideExisting(null,null,null,cfg()),'ready');
 assert.throws(()=>decideExisting(null,null,{accountType:'client'},cfg()),/nunca converter/);
 assert.throws(()=>decideExisting({atelierId:'other'},{name:'Outro',ownerId:'outro'},null,cfg()),/ocupado/);
 assert.equal(decideExisting({atelierId:'x'},{name:'Ateliê Exemplo',ownerId:'owner-user-123'},
   {active:true,accountType:'atelier_member',atelierId:'x'},cfg()),'already_provisioned');
});
