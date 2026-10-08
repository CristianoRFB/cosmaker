import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { resolveCommercialState, resolveFeatureAvailability } from './entitlements';
import { TEST_ONLY_FEATURE_KEY } from './catalog';
import { requireCommercialOwner, requireTenantWorkspaceIdentity, readTenantCommercialDocuments } from './access';
import { isFunctionsEmulator } from './data';

export const getTenantCommercialContext = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const identity = await requireTenantWorkspaceIdentity(call.auth.uid, call.auth.token);
  const documents = await readTenantCommercialDocuments(identity.atelierId);
  const resolution = resolveCommercialState(documents);
  if (resolution.assignment === 'invalid_state') throw new HttpsError('failed-precondition', 'O estado comercial precisa ser revisado pela administração da plataforma.');
  return {
    assignment: resolution.assignment,
    state: resolution.assignment === 'assigned' ? resolution.state : null,
    demoWorkspace: identity.atelier.demoWorkspace === true,
    temporaryAccessExpired: resolution.assignment === 'assigned'
      && ['trial', 'demo'].includes(resolution.state.subscriptionStatus)
      && Boolean(resolution.state.trialUntil)
      && Date.parse(resolution.state.trialUntil!) <= Date.now(),
  };
});

export const getTenantFeatureAccess = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const identity = await requireTenantWorkspaceIdentity(call.auth.uid, call.auth.token);
  requireCommercialOwner(identity.member);
  const featureKey = typeof call.data?.featureKey === 'string' ? call.data.featureKey : '';
  if (!featureKey || Object.keys(call.data ?? {}).some((key) => key !== 'featureKey')) {
    throw new HttpsError('invalid-argument', 'Informe somente uma chave de recurso válida.');
  }
  const documents = await readTenantCommercialDocuments(identity.atelierId);
  const availability = resolveFeatureAvailability(documents, featureKey, { allowTestOnly: isFunctionsEmulator() });
  return {
    featureKey,
    allowed: availability.allowed,
    available: availability.available,
    implemented: availability.implemented,
    configured: availability.configured,
    reason: availability.reason,
  };
});

export const runTestOnlyCommercialOperation = onCall(async (call) => {
  if (!isFunctionsEmulator()) throw new HttpsError('unavailable', 'Operação TEST_ONLY indisponível fora do Emulator.');
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const identity = await requireTenantWorkspaceIdentity(call.auth.uid, call.auth.token);
  requireCommercialOwner(identity.member);
  if (Object.keys(call.data ?? {}).length > 0) {
    throw new HttpsError('invalid-argument', 'A operação TEST_ONLY não aceita tenant, plano ou permissão enviados pelo cliente.');
  }

  const availability = resolveFeatureAvailability(await readTenantCommercialDocuments(identity.atelierId), TEST_ONLY_FEATURE_KEY, { allowTestOnly: true });
  if (!availability.available) {
    throw new HttpsError('permission-denied', `Operação não autorizada: ${availability.reason}.`);
  }
  const { runTestOnlyCommercialProbe } = await import('./test-only-probe');
  return runTestOnlyCommercialProbe(identity.atelierId, call.auth.uid);
});
