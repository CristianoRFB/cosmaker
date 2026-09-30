import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requirePlatformAdmin } from './platform-admin';
import { assertAtelierStatusTransition } from './access-policy';

export const setPlatformAtelierStatus = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  await requirePlatformAdmin(call.auth.uid, call.auth.token);
  const atelierId = typeof call.data?.atelierId === 'string' ? call.data.atelierId.trim() : '';
  const active = call.data?.active;
  if (!atelierId || atelierId.length > 150 || atelierId.includes('/') || typeof active !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Informe o ateliê e o novo status.');
  }

  const atelierRef = adminDb.doc(`ateliers/${atelierId}`);
  const auditRef = adminDb.collection('auditLogs').doc();
  await adminDb.runTransaction(async (transaction) => {
    const atelierSnapshot = await transaction.get(atelierRef);
    if (!atelierSnapshot.exists) throw new HttpsError('not-found', 'O ateliê não foi encontrado.');
    const atelier = atelierSnapshot.data()!;
    const previousActive = atelier.active === true;
    if (!assertAtelierStatusTransition(previousActive, active)) throw new HttpsError('failed-precondition', `O ateliê já está ${active ? 'ativo' : 'suspenso'}.`);
    transaction.update(atelierRef, {
      active,
      status: active ? 'active' : 'suspended',
      ...(active ? { reactivatedAt: FieldValue.serverTimestamp() } : { suspendedAt: FieldValue.serverTimestamp(), suspendedBy: call.auth!.uid }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(auditRef, {
      actorId: call.auth!.uid,
      atelierId,
      action: active ? 'platform.atelier_reactivated' : 'platform.atelier_suspended',
      entity: 'atelier',
      entityId: atelierId,
      before: { active: previousActive, status: atelier.status ?? (previousActive ? 'active' : 'suspended') },
      after: { active, status: active ? 'active' : 'suspended' },
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  return { atelierId, active };
});
