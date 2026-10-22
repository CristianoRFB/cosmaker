import { Timestamp } from 'firebase-admin/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { adminDb, adminStorage } from '../admin';
import { lookupTenant } from '../public/tenant';
import { identity, failure } from '../orders/order-file-bytes';
import { validOrderFileBytes, orderFileHash } from '../orders/order-file-storage';
import { activeShowcaseActor, showcaseIdentity, showcaseInput } from './showcase';
import { showcaseHash, showcaseId, showcaseVersion, nextShowcaseVersion } from './policy';
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const imagePath = (atelierId: string, projectId: string, imageId: string) => `ateliers/${atelierId}/portfolio/${projectId}/images/${imageId}`;

export const uploadShowcaseImage = onRequest({ cors: true, timeoutSeconds: 120, memory: '512MiB' }, async (request, response) => {
  response.set('Cache-Control', 'private, no-store');
  try {
    if (request.method !== 'POST') { response.set('Allow', 'POST'); response.status(405).end(); return; }
    const token = await identity(request);
    const actor = await showcaseIdentity({ uid: token.uid, token }, 'portfolio:manage');
    if (actor.atelier.demoWorkspace === true) throw new HttpsError('failed-precondition', 'Demonstrações não aceitam upload de arquivos.');
    const data = showcaseInput(request.query, ['projectId', 'imageId', 'version', 'caption']);
    if (!showcaseId(data.projectId) || !showcaseId(data.imageId) || typeof data.version !== 'string' || !/^\d+$/.test(data.version)
      || !Number.isSafeInteger(Number(data.version)) || typeof data.caption !== 'string' || data.caption.trim().length > 180) throw new HttpsError('invalid-argument', 'Revise o projeto, a versão e a legenda.');
    const contentType = request.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    const bytes = request.rawBody;
    if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > 10 * 1024 * 1024 || !imageTypes.includes(contentType) || !validOrderFileBytes(bytes, contentType)) throw new HttpsError('invalid-argument', 'Use uma imagem JPEG, PNG ou WebP válida de até 10 MB.');
    const caption = data.caption.trim();
    const sha256 = orderFileHash(bytes);
    const ref = adminDb.doc(`ateliers/${actor.atelierId}/portfolio/${data.projectId}`);
    const check = (project: FirebaseFirestore.DocumentData | undefined) => {
      if (!project) throw new HttpsError('not-found', 'O projeto não pertence a este ateliê.');
      const images = Array.isArray(project.images) ? project.images : [];
      const previous = images.find((image) => image.id === data.imageId);
      if (previous) {
        if (previous.sha256 !== sha256 || previous.caption !== caption) throw new HttpsError('already-exists', 'Este envio já está vinculado a outra imagem.');
        return { images, alreadyApplied: true };
      }
      if (showcaseVersion(project) !== Number(data.version)) throw new HttpsError('aborted', 'O projeto mudou. Atualize antes de enviar.');
      if (project.active === false || images.length >= 8) throw new HttpsError('failed-precondition', 'Arquive menos imagens ou reative o projeto antes de enviar.');
      return { images, alreadyApplied: false };
    };
    const initial = check((await ref.get()).data());
    if (initial.alreadyApplied) { response.json({ imageId: data.imageId, alreadyApplied: true }); return; }
    const path = imagePath(actor.atelierId, String(data.projectId), String(data.imageId));
    const object = adminStorage.bucket().file(path);
    try { await object.save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType, cacheControl: 'private, no-store', metadata: { sha256 } } }); }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && [409, 412].includes(Number(error.code)))) throw error;
      const [metadata] = await object.getMetadata();
      if (metadata.metadata?.sha256 !== sha256 || Number(metadata.size) !== bytes.length || metadata.contentType !== contentType) throw new HttpsError('already-exists', 'Outro conteúdo ocupa esta referência de envio.');
    }
    const result = await adminDb.runTransaction(async (tx) => {
      const atelier = await activeShowcaseActor(tx, actor.atelierId, token.uid, 'portfolio:manage');
      if (atelier.demoWorkspace === true) throw new HttpsError('failed-precondition', 'Demonstrações não aceitam upload de arquivos.');
      const project = await tx.get(ref); const current = check(project.data());
      if (current.alreadyApplied) return { imageId: data.imageId, alreadyApplied: true };
      const version = nextShowcaseVersion(showcaseVersion(project.data())); const now = Timestamp.now();
      tx.update(ref, { images: [...current.images, { id: data.imageId, caption, contentType, sha256, size: bytes.length }], version, updatedAt: now });
      tx.create(adminDb.collection('auditLogs').doc(), { actorId: token.uid, atelierId: actor.atelierId, action: 'showcase.image_uploaded', entity: 'portfolio', entityId: data.projectId,
        after: { imageId: data.imageId, contentType, size: bytes.length, version }, timestamp: now });
      return { imageId: data.imageId, alreadyApplied: false, version };
    });
    response.json(result);
  } catch (error) { const result = failure(error); response.status(result.status).json({ error: result.error }); }
});

export const downloadShowcaseImage = onRequest({ cors: true, timeoutSeconds: 120 }, async (request, response) => {
  response.set('Cache-Control', 'private, no-store'); response.set('X-Content-Type-Options', 'nosniff');
  try {
    if (request.method !== 'GET') { response.set('Allow', 'GET'); response.status(405).end(); return; }
    const data = showcaseInput(request.query, ['tenantSlug', 'projectId', 'imageId']);
    if (!showcaseId(data.projectId) || !showcaseId(data.imageId)) throw new HttpsError('invalid-argument', 'Referência de imagem inválida.');
    const publicRead = data.tenantSlug !== undefined;
    const token = publicRead ? null : await identity(request);
    const actor = token ? await showcaseIdentity({ uid: token.uid, token }, 'portfolio:manage') : null;
    const resolve = async () => {
      const lookup = publicRead ? await lookupTenant(data.tenantSlug) : null;
      const atelierId = actor?.atelierId ?? (lookup?.status === 'available' ? lookup.atelierId : null);
      if (!atelierId) throw new HttpsError('not-found', 'Imagem indisponível.');
      if (actor && token) await showcaseIdentity({ uid: token.uid, token }, 'portfolio:manage');
      const project = await adminDb.doc(`ateliers/${atelierId}/portfolio/${data.projectId}`).get();
      if (!project.exists || (publicRead && (project.data()?.public !== true || project.data()?.active === false))) throw new HttpsError('not-found', 'Imagem indisponível.');
      const image = (Array.isArray(project.data()!.images) ? project.data()!.images : []).find((entry: FirebaseFirestore.DocumentData) => entry.id === data.imageId);
      if (!image || !imageTypes.includes(image.contentType) || !/^[a-f0-9]{64}$/.test(image.sha256)) throw new HttpsError('not-found', 'Imagem indisponível.');
      return { atelierId, image };
    };
    const first = await resolve();
    const [bytes] = await adminStorage.bucket().file(imagePath(first.atelierId, String(data.projectId), String(data.imageId))).download();
    const latest = await resolve();
    if (latest.atelierId !== first.atelierId || latest.image.sha256 !== first.image.sha256 || orderFileHash(bytes) !== latest.image.sha256) throw new HttpsError('failed-precondition', 'A imagem mudou. Atualize a página.');
    response.set('Content-Type', latest.image.contentType); response.set('Content-Length', String(bytes.length)); response.status(200).send(bytes);
  } catch (error) { const result = failure(error); response.status(result.status).json({ error: result.error }); }
});

export const removeShowcaseImage = onCall(async (call) => {
  const actor = await showcaseIdentity(call.auth, 'portfolio:manage');
  const data = showcaseInput(call.data, ['requestId', 'projectId', 'imageId', 'version']);
  if (![data.requestId, data.projectId, data.imageId].every(showcaseId) || !Number.isSafeInteger(data.version)) throw new HttpsError('invalid-argument', 'Selecione a imagem e a versão do projeto.');
  const ref = adminDb.doc(`ateliers/${actor.atelierId}/portfolio/${data.projectId}`);
  const op = adminDb.doc(`ateliers/${actor.atelierId}/showcaseOperations/${showcaseHash([call.auth!.uid, data.requestId])}`);
  const fingerprint = showcaseHash(['remove_image', data.projectId, data.imageId, data.version]);
  return adminDb.runTransaction(async (tx) => {
    await activeShowcaseActor(tx, actor.atelierId, call.auth!.uid, 'portfolio:manage');
    const [project, operation] = await Promise.all([tx.get(ref), tx.get(op)]);
    if (operation.exists) {
      if (operation.data()?.fingerprint !== fingerprint) throw new HttpsError('failed-precondition', 'A chave de repetição foi usada com outros dados.');
      return { version: operation.data()!.version, alreadyApplied: true };
    }
    if (!project.exists) throw new HttpsError('not-found', 'O projeto não pertence a este ateliê.');
    if (showcaseVersion(project.data()) !== data.version) throw new HttpsError('aborted', 'O projeto mudou. Atualize a página.');
    const previous = Array.isArray(project.data()!.images) ? project.data()!.images : [];
    const images = previous.filter((image: FirebaseFirestore.DocumentData) => image.id !== data.imageId);
    if (images.length === previous.length) throw new HttpsError('not-found', 'A imagem não pertence a este projeto.');
    const version = nextShowcaseVersion(Number(data.version)); const now = Timestamp.now();
    tx.update(ref, { images, ...(images.length === 0 ? { public: false } : {}), version, updatedAt: now });
    tx.create(op, { fingerprint, version, createdAt: now });
    tx.create(adminDb.collection('auditLogs').doc(), { actorId: call.auth!.uid, atelierId: actor.atelierId, action: 'showcase.image_removed', entity: 'portfolio', entityId: data.projectId,
      before: { imageId: data.imageId }, after: { version, published: images.length > 0 && project.data()!.public === true }, timestamp: now });
    return { version, alreadyApplied: false };
  });
});
