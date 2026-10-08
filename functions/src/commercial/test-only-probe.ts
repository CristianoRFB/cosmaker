import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { resolveCommercialState, resolveFeatureAvailability, resolveLimit } from './entitlements';
import { TEST_ONLY_FEATURE_KEY, TEST_ONLY_LIMIT_KEY } from './catalog';
import { adminDb } from '../admin';
import { commercialConfigRef, commercialStateRef } from './data';

export async function runTestOnlyCommercialProbe(atelierId: string, actorId: string) {
  const stateRef = commercialStateRef(atelierId);
  const configRef = commercialConfigRef(atelierId);
  const atelierRef = adminDb.doc(`ateliers/${atelierId}`);
  const usageRef = adminDb.doc(`ateliers/${atelierId}/commercialUsage/test-only-operation-probe`);
  const recordRef = adminDb.collection(`ateliers/${atelierId}/commercialOperations`).doc();

  return adminDb.runTransaction(async (transaction) => {
    const [atelierSnapshot, stateSnapshot, configSnapshot, usageSnapshot] = await Promise.all([
      transaction.get(atelierRef), transaction.get(stateRef), transaction.get(configRef), transaction.get(usageRef),
    ]);
    if (!atelierSnapshot.exists || atelierSnapshot.data()?.active !== true) throw new HttpsError('permission-denied', 'O ateliê está operacionalmente suspenso.');
    if (!stateSnapshot.exists) throw new HttpsError('failed-precondition', 'A atribuição comercial está pendente.');
    const tenant = {
      commercialState: stateSnapshot.data(),
      featureConfig: configSnapshot.data()?.featureConfig,
    };
    const state = resolveCommercialState(tenant);
    if (state.assignment !== 'assigned') throw new HttpsError('failed-precondition', 'O estado comercial não é válido.');
    const availability = resolveFeatureAvailability(tenant, TEST_ONLY_FEATURE_KEY, { allowTestOnly: true });
    if (!availability.available) throw new HttpsError('permission-denied', `Operação não autorizada: ${availability.reason}.`);
    const limit = resolveLimit(tenant, TEST_ONLY_LIMIT_KEY, true);
    if (limit.status === 'unknown') throw new HttpsError('invalid-argument', 'A chave de limite não é reconhecida.');
    if (limit.status === 'not_configured') throw new HttpsError('failed-precondition', 'O limite desta operação não foi configurado.');

    const currentCount = Number(usageSnapshot.data()?.count ?? 0);
    if (!Number.isSafeInteger(currentCount) || currentCount < 0) throw new HttpsError('internal', 'O contador de uso do Emulator está inválido.');
    if (limit.limit !== null && currentCount >= limit.limit) throw new HttpsError('resource-exhausted', 'O limite TEST_ONLY desta fixture foi atingido.');

    transaction.create(recordRef, {
      actorId,
      featureKey: TEST_ONLY_FEATURE_KEY,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.set(usageRef, { count: currentCount + 1, updatedAt: FieldValue.serverTimestamp() });
    return { accepted: true, featureKey: TEST_ONLY_FEATURE_KEY, used: currentCount + 1, limit: limit.limit };
  });
}
