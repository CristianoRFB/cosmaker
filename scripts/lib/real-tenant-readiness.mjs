/**
 * Offline, fail-closed onboarding checklist. This is NOT a source of authorization:
 * every checked item must still be evidenced and approved outside the repository.
 * No Firebase calls, credential loading, network requests or production mutations.
 */
export const COMMERCIAL_STAGES=Object.freeze(['INTERESTED','CONTRACTED','PROVISIONED_UNPUBLISHED','LIVE']);
export const REQUIRED_PROVISIONING=Object.freeze([
  'contractAccepted',
  'scopeAccepted',
  'ownerIdentityVerified',
  'brandAndMediaRightsVerified',
  'productionProjectAndCostsApproved',
  'platformOperatorAuthorized'
]);
export const REQUIRED_PUBLICATION=Object.freeze([
  'privacyAndRetentionApproved',
  'tenantIsolationAndRolesTested',
  'storageAndUploadsTested',
  'abuseProtectionReviewed',
  'backupAndRestoreTested',
  'productionSmokeTested',
  'clientAcceptanceRecorded',
  'publicationExplicitlyAuthorized'
]);
export const ALL_CHECKS=Object.freeze([...REQUIRED_PROVISIONING,...REQUIRED_PUBLICATION]);
const allowedTopKeys=['schemaVersion','candidateSlug','businessType','commercialStage','checks'];
const validSlug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertShape(value,fields,label){
  if(!value || typeof value!=='object' || Array.isArray(value))throw new Error(label+' deve ser um objeto.');
  const keys=Object.keys(value);
  if(keys.some(key=>!fields.includes(key)))throw new Error(label+': campo inesperado (possível dado pessoal ou segredo).');
  if(fields.some(key=>!Object.hasOwn(value,key)))throw new Error(label+': campo obrigatório ausente.');
}

/** Strict schema rejects extra fields, private contacts, arbitrary links and secrets. */
export function validateReadinessManifest(raw){
  assertShape(raw,allowedTopKeys,'Manifesto');
  if(raw.schemaVersion!==1)throw new Error('Versão do manifesto não suportada.');
  if(typeof raw.candidateSlug!=='string'||raw.candidateSlug.length<3||raw.candidateSlug.length>63
    ||!validSlug.test(raw.candidateSlug))throw new Error('Slug de candidato inválido.');
  if(!['cosmaker','caps'].includes(raw.businessType))throw new Error('Tipo de negócio inválido.');
  if(!COMMERCIAL_STAGES.includes(raw.commercialStage))throw new Error('Estado comercial inválido.');
  assertShape(raw.checks,ALL_CHECKS,'Checklist');
  if(ALL_CHECKS.some(key=>typeof raw.checks[key]!=='boolean'))throw new Error('Todos os checks precisam ser booleanos.');
  return raw;
}

/**
 * Two separate gates: an interested lead cannot be provisioned; a provisioned,
 * unpublished tenant cannot go live until its own production verification.
 * This reports human-reviewed evidence only; it NEVER grants access.
 */
export function assessReadiness(input){
  const record=validateReadinessManifest(input);
  const missingProvisioning=REQUIRED_PROVISIONING.filter(key=>!record.checks[key]);
  const missingPublication=REQUIRED_PUBLICATION.filter(key=>!record.checks[key]);
  const provisioningBlockers=[
    ...(record.commercialStage==='CONTRACTED'?[]:['commercialStage=CONTRACTED']),
    ...missingProvisioning
  ];
  const publicationBlockers=[
    ...(record.commercialStage==='PROVISIONED_UNPUBLISHED'?[]:['commercialStage=PROVISIONED_UNPUBLISHED']),
    ...missingProvisioning,...missingPublication
  ];
  return {
    schemaVersion:1,
    candidateSlug:record.candidateSlug,
    businessType:record.businessType,
    commercialStage:record.commercialStage,
    provisioning:{ready:provisioningBlockers.length===0,blockers:provisioningBlockers},
    publication:{ready:publicationBlockers.length===0,blockers:publicationBlockers},
    note:'Checklist documental local; permissões, identidade, configuração e dados devem ser verificados no servidor antes de qualquer ação real.'
  };
}
