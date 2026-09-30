import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';

export const publishQuote = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na conta do ateliê para disponibilizar o orçamento.');
  const { atelierId, quoteId } = call.data as { atelierId?: unknown; quoteId?: unknown };
  if (typeof atelierId !== 'string' || !atelierId || typeof quoteId !== 'string' || !quoteId) {
    throw new HttpsError('invalid-argument', 'Ateliê e orçamento são obrigatórios.');
  }
  const memberRef = adminDb.doc(`ateliers/${atelierId}/members/${call.auth.uid}`);
  const [member, atelierSnapshot] = await Promise.all([memberRef.get(), adminDb.doc(`ateliers/${atelierId}`).get()]);
  const membership = member.data();
  if (!atelierSnapshot.exists || atelierSnapshot.data()?.active !== true || !member.exists || membership?.active !== true
    || (!['owner', 'admin'].includes(String(membership.role)) && !membership?.permissions?.includes('quotes:write'))) {
    throw new HttpsError('permission-denied', 'Você não tem permissão para disponibilizar orçamentos neste ateliê.');
  }

  const atelier = adminDb.collection('ateliers').doc(atelierId);
  const quoteRef = atelier.collection('quotes').doc(quoteId);
  const auditRef = adminDb.collection('auditLogs').doc();
  await adminDb.runTransaction(async (transaction) => {
    const quoteSnapshot = await transaction.get(quoteRef);
    if (!quoteSnapshot.exists) throw new HttpsError('not-found', 'O orçamento não foi encontrado neste ateliê.');
    const quote = quoteSnapshot.data()!;
    if (quote.status !== 'draft') throw new HttpsError('failed-precondition', 'Somente um rascunho pode ser disponibilizado.');
    const requestRef = atelier.collection('quoteRequests').doc(String(quote.requestId));
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists) throw new HttpsError('failed-precondition', 'A solicitação ligada ao orçamento não existe.');
    const now = Timestamp.now();
    transaction.update(quoteRef, { status: 'sent', sentAt: now, updatedAt: now });
    transaction.update(requestRef, { status: 'quoted', updatedAt: now });
    transaction.set(auditRef, {
      actorId: call.auth!.uid,
      atelierId,
      action: 'quote.sent_to_client_portal',
      entity: 'quote',
      entityId: quoteId,
      before: { status: quote.status, total: quote.total },
      after: { status: 'sent', total: quote.total },
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  return { quoteId, status: 'sent' as const };
});
