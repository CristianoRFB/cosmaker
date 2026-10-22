import { HttpsError, onRequest } from 'firebase-functions/v2/https';
import { adminDb, adminStorage } from '../admin';
import { requireTenantWorkspaceIdentity } from '../commercial/access';
import { identity, failure } from '../orders/order-file-bytes';
import { productionId, productionFingerprint } from '../orders/production-configuration';
import { orderFileHash, revokeOrderFileTokens, validOrderFileBytes } from '../orders/order-file-storage';

export const downloadQuoteReferenceBytes = onRequest({ cors: true, timeoutSeconds: 120 }, async (request, response) => {
  response.set('Cache-Control', 'private, no-store'); response.set('X-Content-Type-Options', 'nosniff');
  try {
    if (request.method !== 'GET') { response.set('Allow', 'GET'); response.status(405).end(); return; }
    const token = await identity(request);
    if (Object.keys(request.query).some((key) => !['requestId', 'referenceId'].includes(key))) throw new HttpsError('invalid-argument', 'Há campos fora do contrato da referência.');
    const requestId = productionId(request.query.requestId, 'Solicitação'); const referenceId = productionId(request.query.referenceId, 'Referência');
    const workspace = await requireTenantWorkspaceIdentity(token.uid, token);
    const atelierId = workspace.atelierId; const root = adminDb.doc(`ateliers/${atelierId}`);
    const requestRef = root.collection('quoteRequests').doc(requestId); const referenceRef = requestRef.collection('references').doc(referenceId);
    const path = `ateliers/${atelierId}/quoteRequests/${requestId}/references/${referenceId}`;
    async function authorizedReference() {
      return adminDb.runTransaction(async (tx) => {
        const [atelier, profile, member, quoteRequest, reference] = await Promise.all([
          tx.get(root), tx.get(adminDb.doc(`users/${token.uid}`)), tx.get(root.collection('members').doc(token.uid)), tx.get(requestRef), tx.get(referenceRef),
        ]);
        const permissions = member.get('permissions');
        if (atelier.get('active') !== true || profile.get('active') !== true || profile.get('accountType') !== 'atelier_member' || profile.get('atelierId') !== atelierId || member.get('active') !== true
          || !(['owner', 'admin'].includes(member.get('role')) || (Array.isArray(permissions) && (permissions.includes('quotes:read') || permissions.includes('quotes:write'))))) throw new HttpsError('permission-denied', 'Sua conta não tem acesso às referências deste ateliê.');
        const value = reference.data();
        if (!quoteRequest.exists || !value || (value.uploadStatus !== undefined && value.uploadStatus !== 'ready') || value.archived === true) throw new HttpsError('not-found', 'A referência não está disponível.');
        if (value.storagePath !== path || !['image/png', 'image/jpeg', 'image/webp'].includes(value.contentType) || !Number.isSafeInteger(value.size) || value.size < 1 || value.size > 10 * 1024 * 1024 || typeof value.originalName !== 'string' || value.originalName.length > 180) throw new HttpsError('failed-precondition', 'A referência precisa de conciliação.');
        return { contentType: value.contentType as string, originalName: value.originalName, size: value.size as number, generation: value.storageGeneration ?? null, sha256: value.sha256 ?? null };
      });
    }
    const before = await authorizedReference();
    const object = adminStorage.bucket().file(path, before.generation ? { generation: String(before.generation) } : undefined);
    let metadata;
    try { [metadata] = await object.getMetadata(); } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && Number(error.code) === 404) throw new HttpsError('not-found', 'O conteúdo desta referência não está disponível.');
      throw new HttpsError('unavailable', 'Não foi possível conferir a referência agora.');
    }
    if (Number(metadata.size) !== before.size || metadata.contentType !== before.contentType || (before.generation && String(metadata.generation) !== String(before.generation))) throw new HttpsError('failed-precondition', 'O conteúdo não corresponde à referência registrada.');
    const [bytes] = await object.download();
    if (bytes.length !== before.size || !validOrderFileBytes(bytes, before.contentType) || (before.sha256 && orderFileHash(bytes) !== before.sha256)) throw new HttpsError('failed-precondition', 'O conteúdo da referência precisa de revisão.');
    await revokeOrderFileTokens(path);
    const after = await authorizedReference();
    if (productionFingerprint(before) !== productionFingerprint(after)) throw new HttpsError('aborted', 'A referência mudou durante a transferência. Atualize a solicitação.');
    response.set('Content-Type', after.contentType); response.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(after.originalName)}`); response.send(bytes);
  } catch (error) { const result = failure(error); response.status(result.status).json({ error: result.error }); }
});
