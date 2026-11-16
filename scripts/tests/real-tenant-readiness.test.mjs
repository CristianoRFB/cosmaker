import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  assessReadiness,validateReadinessManifest,REQUIRED_PROVISIONING,REQUIRED_PUBLICATION,ALL_CHECKS
} from '../lib/real-tenant-readiness.mjs';

const candidate=(commercialStage='INTERESTED')=>({
  schemaVersion:1,candidateSlug:'dogstar-cap',businessType:'caps',commercialStage,
  checks:Object.fromEntries(ALL_CHECKS.map(key=>[key,false]))
});

test('lead interessado nunca é provisionado nem publicado automaticamente',()=>{
  const report=assessReadiness(candidate());
  assert.equal(report.provisioning.ready,false);
  assert.equal(report.publication.ready,false);
  assert.ok(report.provisioning.blockers.includes('commercialStage=CONTRACTED'));
  assert.ok(report.publication.blockers.includes('commercialStage=PROVISIONED_UNPUBLISHED'));
});

test('assinatura sozinha não substitui verificações de identidade, custos e autorização',()=>{
  const report=assessReadiness(candidate('CONTRACTED'));
  assert.equal(report.provisioning.ready,false);
  assert.equal(report.provisioning.blockers.length,REQUIRED_PROVISIONING.length);
  assert.equal(report.publication.ready,false);
});

test('separa autorização de provisionamento da publicação e impede duplicar tenant',()=>{
  const m=candidate('CONTRACTED');
  for(const key of REQUIRED_PROVISIONING)m.checks[key]=true;
  const report=assessReadiness(m);
  assert.equal(report.provisioning.ready,true);
  assert.equal(report.publication.ready,false);
  const alreadyProvisioned={...m,commercialStage:'PROVISIONED_UNPUBLISHED'};
  const provisioned=assessReadiness(alreadyProvisioned);
  assert.equal(provisioned.provisioning.ready,false);
  assert.equal(provisioned.publication.ready,false);
  for(const key of REQUIRED_PUBLICATION)alreadyProvisioned.checks[key]=true;
  const launch=assessReadiness(alreadyProvisioned);
  assert.equal(launch.publication.ready,true);
  assert.equal(launch.provisioning.ready,false);
  assert.equal(assessReadiness({...alreadyProvisioned,commercialStage:'INTERESTED'}).publication.ready,false);
});

test('não aceita campo pessoal, segredo, check desconhecido ou ausente',()=>{
  const m=candidate();
  assert.throws(()=>validateReadinessManifest({...m,ownerEmail:'person@example.com'}),/inesperado/);
  assert.throws(()=>validateReadinessManifest({...m,token:'secret'}),/inesperado/);
  assert.throws(()=>validateReadinessManifest({...m,checks:{...m.checks,extra:true}}),/inesperado/);
  const without={...m.checks};delete without.contractAccepted;
  assert.throws(()=>validateReadinessManifest({...m,checks:without}),/ausente/);
  assert.throws(()=>validateReadinessManifest({...m,checks:{...m.checks,contractAccepted:'true'}}),/booleanos/);
});

test('recusa valores e candidatos inconsistentes',()=>{
  for(const slug of ['Dogstar Cap','dogstar/cap','dogstar--cap','x','../admin'])
    assert.throws(()=>validateReadinessManifest({...candidate(),candidateSlug:slug}),/Slug/);
  assert.throws(()=>validateReadinessManifest({...candidate(),businessType:'ecommerce'}),/negócio/);
  assert.throws(()=>validateReadinessManifest({...candidate(),commercialStage:'ACTIVE'}),/comercial/);
  assert.throws(()=>validateReadinessManifest({...candidate(),schemaVersion:2}),/Versão/);
});

test('CLI da Dogstar informa bloqueios sem requerer credencial Firebase e pode falhar fechado',()=>{
  const script='scripts/check-tenant-readiness.mjs';
  const file='--file=onboarding/candidates/dogstar-cap.json';
  const status=spawnSync(process.execPath,[script,file],{encoding:'utf8'});
  assert.equal(status.status,0,status.stderr);
  const record=JSON.parse(status.stdout);
  assert.equal(record.commercialStage,'INTERESTED');
  assert.equal(record.provisioning.ready,false);
  assert.equal(record.publication.ready,false);
  assert.ok(!status.stdout.includes('ownerEmail'));
  const blocked=spawnSync(process.execPath,[script,file,'--require=publication'],{encoding:'utf8'});
  assert.equal(blocked.status,2,blocked.stderr);
  const escaped=spawnSync(process.execPath,[script,'--file=../../.env.local'],{encoding:'utf8'});
  assert.equal(escaped.status,1);
  assert.match(escaped.stderr,/Readiness bloqueado/);
});
