import { HttpsError, onRequest } from 'firebase-functions/v2/https';
import { adminDb, adminStorage } from '../admin';
import { requireTenantWorkspaceIdentity } from '../commercial/access';
import { identity, failure } from './order-file-bytes';
import { orderFileHash, revokeOrderFileTokens, validOrderFileBytes } from './order-file-storage';

/** Read-only compatibility for dormant raw paths. No new upload, deletion or public URL. */
export const downloadLegacyAtelierFileBytes = onRequest({ cors: true, timeoutSeconds: 120 }, async (request, response) => {
  response.set('Cache-Control', 'private, no-store'); response.set('X-Content-Type-Options', 'nosniff');
  try {
    if (request.method !== 'GET') { response.set('Allow', 'GET'); response.status(405).end(); return; }
    const token = await identity(request);
    if (Object.keys(request.query).some(key => key !== 'path') || typeof request.query.path !== 'string') throw new HttpsError('invalid-argument', 'Caminho legado inválido.');
    const relative = request.query.path;
    const parts = relative.split('/');
    if (parts.some(part => !/^[A-Za-z0-9_. -]{1,180}$/.test(part) || ['.', '..'].includes(part))) throw new HttpsError('invalid-argument', 'Caminho legado inválido.');
    let permission = ''; let entityPath = ''; let maximum = 20 * 1024 * 1024; let imageOnly = false;
    if (parts.length === 2 && parts[0] === 'branding') { permission = 'atelier:settings'; maximum = 5 * 1024 * 1024; imageOnly = true; }
    else if (parts.length === 3 && parts[0] === 'portfolio') { permission = 'portfolio:manage'; entityPath = `portfolio/${parts[1]}`; imageOnly = true; }
    else if (parts.length === 4 && parts[0] === 'clients' && parts[2] === 'measurements') { permission = 'clients:read'; entityPath = `clients/${parts[1]}`; }
    else if (parts.length === 2 && ['contracts', 'invoices'].includes(parts[0])) permission = parts[0] === 'invoices' ? 'finance:read' : 'orders:read';
    else if (parts.length === 4 && parts[0] === 'orders' && ['shipping', 'documents', 'references', 'approvals'].includes(parts[2])) { permission = 'orders:read'; entityPath = `orders/${parts[1]}`; }
    else throw new HttpsError('invalid-argument', 'Este caminho usa outro contrato de arquivos.');
    const workspace = await requireTenantWorkspaceIdentity(token.uid, token);
    const root = adminDb.doc(`ateliers/${workspace.atelierId}`);
    const authorize = () => adminDb.runTransaction(async tx => {
      const [atelier, profile, member, entity] = await Promise.all([
        tx.get(root), tx.get(adminDb.doc(`users/${token.uid}`)), tx.get(root.collection('members').doc(token.uid)),
        entityPath ? tx.get(adminDb.doc(`${root.path}/${entityPath}`)) : Promise.resolve(null),
      ]);
      const permissions = member.get('permissions');
      if (atelier.get('active') !== true || profile.get('active') !== true || profile.get('accountType') !== 'atelier_member'
        || profile.get('atelierId') !== workspace.atelierId || member.get('active') !== true
        || !(['owner', 'admin'].includes(member.get('role')) || (Array.isArray(permissions) && (permissions.includes(permission) || (permission === 'orders:read' && permissions.includes('orders:manage')))))) throw new HttpsError('permission-denied', 'Sua conta não tem acesso a este arquivo.');
      if (entityPath && !entity?.exists) throw new HttpsError('not-found', 'O registro vinculado não está disponível.');
    });
    await authorize();
    const path = `${root.path}/${relative}`;
    const file = adminStorage.bucket().file(path);
    let metadata;
    try { [metadata] = await file.getMetadata(); }
    catch (error) { if (error && typeof error === 'object' && 'code' in error && Number(error.code) === 404) throw new HttpsError('not-found', 'Arquivo não encontrado.'); throw error; }
    const type = metadata.contentType ?? '';
    const size = Number(metadata.size);
    if (!Number.isSafeInteger(size) || size < 1 || size > maximum || !['image/jpeg', 'image/png', 'image/webp', ...(imageOnly ? [] : ['application/pdf'])].includes(type)
      || (['contracts', 'invoices'].includes(parts[0]) && type !== 'application/pdf')) throw new HttpsError('failed-precondition', 'O arquivo legado precisa de revisão.');
    const [bytes] = await file.download();
    if (bytes.length !== size || !validOrderFileBytes(bytes, type)) throw new HttpsError('failed-precondition', 'O conteúdo legado precisa de revisão.');
    await revokeOrderFileTokens(path);
    await authorize();
    const [after] = await file.getMetadata();
    if (String(after.generation) !== String(metadata.generation)) throw new HttpsError('aborted', 'O arquivo mudou durante a leitura.');
    response.set('Content-Type', type); response.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(parts.at(-1)!)}`);
    response.set('X-Content-SHA256', orderFileHash(bytes)); response.send(bytes);
  } catch (error) { const result = failure(error); response.status(result.status).json({ error: result.error }); }
});
