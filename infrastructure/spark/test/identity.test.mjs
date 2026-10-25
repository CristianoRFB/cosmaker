import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT, generateKeyPair } from 'jose';
import { verifySignedFirebaseToken, assertUserState } from '../src/identity.mjs';
import { localConfig } from '../src/core.mjs';

test('Firebase RS256 identity: signature, issuer, audience, expiry, algorithm and revoked account',async()=>{
  const {privateKey,publicKey}=await generateKeyPair('RS256');
  const other=await generateKeyPair('RS256');
  const now=Math.floor(Date.now()/1000);
  const sign=(overrides={},key=privateKey)=>new SignJWT({sub:'synthetic-uid',iss:'https://securetoken.google.com/demo-cosmaker',aud:'demo-cosmaker',iat:now,exp:now+300,auth_time:now,email_verified:true,...overrides}).setProtectedHeader({alg:'RS256',kid:'synthetic'}).sign(key);
  const token=await sign();
  const claims=await verifySignedFirebaseToken(token,'demo-cosmaker',publicKey);
  assert.equal(claims.sub,'synthetic-uid');
  for(const patch of [{iss:'https://attacker.invalid'},{aud:'other-project'},{exp:now-1},{auth_time:now+500},{sub:''},{iat:now+50}]) await assert.rejects(verifySignedFirebaseToken(await sign(patch),'demo-cosmaker',publicKey),{code:'unauthenticated'});
  await assert.rejects(verifySignedFirebaseToken(await sign({},other.privateKey),'demo-cosmaker',publicKey),{code:'unauthenticated'});
  await assert.rejects(verifySignedFirebaseToken(token.slice(0,-8)+'tampered','demo-cosmaker',publicKey),{code:'unauthenticated'});
  await assert.rejects(verifySignedFirebaseToken('eyJhbGciOiJub25lIn0.e30.','demo-cosmaker',publicKey),{code:'unauthenticated'});
  assert.doesNotThrow(()=>assertUserState(claims,{localId:claims.sub,emailVerified:true}));
  for(const user of [null,{localId:'other'},{localId:claims.sub,disabled:true},{localId:claims.sub,validSince:String(now+1)}]) assert.throws(()=>assertUserState(claims,user),{code:'unauthenticated'});
  assert.throws(()=>assertUserState(claims,{localId:claims.sub,emailVerified:false}),{code:'failed-precondition'});
});
test('Emulator privileges cannot select real projects or destinations',()=>{
  const env={MODE:'emulator',PROJECT_ID:'demo-cosmaker',AUTH_ORIGIN:'http://127.0.0.1:19099',FIRESTORE_ORIGIN:'http://127.0.0.1:18080',DATABASE_ORIGIN:'http://127.0.0.1:19000'};
  assert.equal(localConfig(env).project,'demo-cosmaker');
  for(const patch of [{MODE:'production'},{PROJECT_ID:'cosmaker-os-dev'},{AUTH_ORIGIN:'https://identitytoolkit.googleapis.com'},{DATABASE_ORIGIN:'http://127.0.0.1.evil.invalid:9000'},{FIRESTORE_ORIGIN:'http://127.0.0.1:80/private'}]) assert.throws(()=>localConfig({...env,...patch}),{code:'failed-precondition'});
});
