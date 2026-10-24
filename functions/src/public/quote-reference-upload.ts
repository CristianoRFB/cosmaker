import { randomUUID, timingSafeEqual } from 'node:crypto';
import { FieldValue, type Transaction, type DocumentReference } from 'firebase-admin/firestore';
import { HttpsError, onRequest } from 'firebase-functions/v2/https';
import { adminDb, adminStorage } from '../admin';
import { failure } from '../orders/order-file-bytes';
import { orderFileHash, revokeOrderFileTokens, validOrderFileBytes } from '../orders/order-file-storage';
import { lookupTenant, assertIntakeAvailable } from './tenant';

/** Anonymous capability authorizes one declared image only, never a read or a tenant selection. */
export const uploadPublicQuoteReferenceBytes = onRequest({ cors: true, timeoutSeconds: 120, memory: '512MiB' }, async (request, response) => {
  response.set('Cache-Control', 'private, no-store');
  const lease: { ref: DocumentReference | null; id: string } = { ref: null, id: randomUUID() };
  try {
    if (request.method !== 'POST') { response.set('Allow', 'POST'); response.status(405).end(); return; }
    const data = request.query;
    if (Object.keys(data).some((key) => !['tenantSlug', 'requestId', 'uploadId'].includes(key))
      || typeof data.tenantSlug !== 'string' || typeof data.requestId !== 'string' || !/^[A-Za-z0-9_-]{10,150}$/.test(data.requestId)
      || typeof data.uploadId !== 'string' || !/^[a-f0-9-]{36}$/i.test(data.uploadId)) throw new HttpsError('invalid-argument', 'Referência inválida.');
    const capability = request.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!capability) throw new HttpsError('permission-denied', 'Autorização de envio inválida.');
    const capabilityHash = Buffer.from(orderFileHash(Buffer.from(capability)), 'hex');
    const lookup = await lookupTenant(data.tenantSlug);
    const atelierId = assertIntakeAvailable(lookup);
    const slug = lookup.tenant!.slug;
    const requestRef = adminDb.doc(`ateliers/${atelierId}/quoteRequests/${data.requestId}`);
    const ref = requestRef.collection('references').doc(data.uploadId);
    const path = `${requestRef.path}/references/${data.uploadId}`;
    const bytes = request.rawBody;
    const contentType = request.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > 10 * 1024 * 1024
      || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType) || !validOrderFileBytes(bytes, contentType)) throw new HttpsError('invalid-argument', 'Use JPEG, PNG ou WebP válido de até 10 MB.');
    const sha256 = orderFileHash(bytes);
    const authorize = async (tx: Transaction) => {
      const [atelier, profile, address, intake, reference] = await Promise.all([
        tx.get(adminDb.doc(`ateliers/${atelierId}`)), tx.get(adminDb.doc(`publicAteliers/${atelierId}`)),
        tx.get(adminDb.doc(`publicAtelierSlugs/${slug}`)), tx.get(requestRef), tx.get(ref),
      ]);
      const value = reference.data();
      const storedHash = typeof value?.uploadCapabilityHash === 'string' && /^[a-f0-9]{64}$/.test(value.uploadCapabilityHash) ? Buffer.from(value.uploadCapabilityHash, 'hex') : null;
      if (!storedHash || !timingSafeEqual(storedHash, capabilityHash) || value!.uploadSlug !== slug) throw new HttpsError('permission-denied', 'Autorização de envio inválida.');
      if (!Number.isFinite(value!.uploadExpiresAtMs) || value!.uploadExpiresAtMs <= Date.now()) throw new HttpsError('permission-denied', 'A autorização de envio expirou.');
      if (atelier.get('active') !== true || atelier.get('demoWorkspace') === true || profile.get('published') !== true
        || profile.get('quoteRequestsEnabled') !== true || profile.get('slug') !== slug || address.get('atelierId') !== atelierId || address.get('slug') !== slug
        || intake.get('status') !== 'new' || value!.storagePath !== path || !['pending', 'ready'].includes(value!.uploadStatus)) throw new HttpsError('failed-precondition', 'A solicitação não permite este envio.');
      if (value!.sha256 !== sha256 || value!.size !== bytes.length || value!.contentType !== contentType) throw new HttpsError('invalid-argument', 'O conteúdo não corresponde à referência declarada.');
      return value!;
    };
    const current = await adminDb.runTransaction(async (tx) => {
      const value = await authorize(tx);
      if (value.uploadStatus === 'ready') return value;
      if (Number(value.uploadLeaseExpiresAtMs) > Date.now()) throw new HttpsError('aborted', 'Este envio está em andamento. Tente novamente.');
      tx.update(ref, { uploadLeaseId: lease.id, uploadLeaseExpiresAtMs: Date.now() + 300_000 });
      lease.ref = ref;
      return value;
    });
    const object = adminStorage.bucket().file(path);
    const verifyExisting = async () => {
      const [metadata] = await object.getMetadata();
      if (Number(metadata.size) !== bytes.length || metadata.contentType !== contentType
        || (current.uploadStatus === 'ready' && String(metadata.generation) !== current.storageGeneration)) throw new HttpsError('already-exists', 'O arquivo existente não corresponde ao envio.');
      const [stored] = await object.download();
      if (orderFileHash(stored) !== sha256) throw new HttpsError('already-exists', 'O arquivo existente não corresponde ao envio.');
    };
    const [exists] = await object.exists();
    if (exists) await verifyExisting();
    else {
      if (current.uploadStatus === 'ready') throw new HttpsError('failed-precondition', 'O arquivo concluído precisa de conferência.');
      try {
        await object.save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType, cacheControl: 'private, no-store', metadata: { sha256 } } });
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && [409, 412].includes(Number(error.code)))) throw error;
        await verifyExisting();
      }
    }
    if (current.uploadStatus !== 'ready') await revokeOrderFileTokens(path);
    const [metadata] = await object.getMetadata();
    await adminDb.runTransaction(async (tx) => {
      const value = await authorize(tx);
      if (current.uploadStatus === 'ready') {
        if (value.uploadStatus !== 'ready' || value.storageGeneration !== String(metadata.generation)) throw new HttpsError('failed-precondition', 'A referência mudou.');
        return; // Consumed capability can only acknowledge the identical immutable receipt, without writes.
      }
      if (value.uploadStatus !== 'pending' || value.uploadLeaseId !== lease.id) throw new HttpsError('aborted', 'O envio mudou. Tente novamente.');
      tx.update(ref, { uploadStatus: 'ready', storageGeneration: String(metadata.generation), validatedAt: FieldValue.serverTimestamp(), capabilityConsumedAt: FieldValue.serverTimestamp(), uploadLeaseId: FieldValue.delete(), uploadLeaseExpiresAtMs: FieldValue.delete() });
    });
    response.json({ uploadId: data.uploadId, ready: true, alreadyApplied: current.uploadStatus === 'ready' });
  } catch (error) { const result = failure(error); response.status(result.status).json({ error: result.error }); }
  finally {
    if (lease.ref) {
      const ref = lease.ref;
      await adminDb.runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (current.get('uploadLeaseId') === lease.id) tx.update(ref, { uploadLeaseId: FieldValue.delete(), uploadLeaseExpiresAtMs: FieldValue.delete() });
      }).catch(() => undefined);
    }
  }
});
