import { Timestamp, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireTenantWorkspaceIdentity } from '../commercial/access';
import { requireVerifiedIdentity } from '../orders/access';
import { lookupTenant } from '../public/tenant';

import { showcaseId, showcaseHash, showcaseCategories, showcaseVersion, nextShowcaseVersion, showcasePublicProjection } from './policy';

export function showcaseInput(value: unknown, fields: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !fields.includes(key))) throw new HttpsError('invalid-argument', 'O formulário contém campos inválidos.');
  return value as Record<string, unknown>;
}
function text(value: unknown, min: number, max: number) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new HttpsError('invalid-argument', 'Revise os textos do conteúdo.');
  return value.trim();
}
export function showcasePermission(member: FirebaseFirestore.DocumentData, permission: string) {
  return ['owner', 'admin'].includes(member.role) || (Array.isArray(member.permissions)
    && (member.permissions.includes(permission) || (permission === 'services:read' && member.permissions.includes('services:write'))));
}
export async function showcaseIdentity(auth: { uid: string; token: Record<string, unknown> } | undefined, permission: string) {
  requireVerifiedIdentity(auth);
  const identity = await requireTenantWorkspaceIdentity(auth!.uid, auth!.token);
  if (!showcasePermission(identity.member, permission)) throw new HttpsError('permission-denied', 'Seu perfil não tem permissão para manter este conteúdo.');
  return identity;
}
export async function activeShowcaseActor(tx: Transaction, atelierId: string, uid: string, permission: string) {
  const [atelier, profile, member] = await Promise.all([
    tx.get(adminDb.doc(`ateliers/${atelierId}`)), tx.get(adminDb.doc(`users/${uid}`)), tx.get(adminDb.doc(`ateliers/${atelierId}/members/${uid}`)),
  ]);
  if (atelier.data()?.active !== true || profile.data()?.active !== true || profile.data()?.accountType !== 'atelier_member'
    || profile.data()?.atelierId !== atelierId || member.data()?.active !== true || !showcasePermission(member.data()!, permission)) {
    throw new HttpsError('permission-denied', 'O vínculo ou a permissão do conteúdo mudou. Atualize a página.');
  }
  return atelier.data()!;
}
function sortRows<T extends { sortOrder: number; id: string }>(rows: T[]) { return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)); }
export const listAtelierShowcase = onCall(async (call) => {
  const data = showcaseInput(call.data, ['section']);
  if (!['services', 'portfolio'].includes(String(data.section))) throw new HttpsError('invalid-argument', 'Selecione serviços ou portfólio.');
  const section = data.section as 'services' | 'portfolio';
  const actor = await showcaseIdentity(call.auth, section === 'services' ? 'services:read' : 'portfolio:manage');
  const [snapshot, profile] = await Promise.all([
    adminDb.collection(`ateliers/${actor.atelierId}/${section}`).limit(501).get(),
    showcasePermission(actor.member, 'atelier:settings') ? adminDb.doc(`publicAteliers/${actor.atelierId}`).get() : Promise.resolve(null),
  ]);
  if (snapshot.size > 500) throw new HttpsError('resource-exhausted', 'Este catálogo exige paginação antes de ser exibido integralmente.');
  return { items: sortRows(snapshot.docs.map((doc) => ({ ...showcasePublicProjection(doc.id, doc.data(), section), public: doc.data().public === true,
    active: doc.data().active !== false, internalNotes: typeof doc.data().internalNotes === 'string' ? doc.data().internalNotes.slice(0, 1000) : '', version: showcaseVersion(doc.data()) }))),
    profile: profile?.exists ? { slug: profile.data()!.slug, name: profile.data()!.name ?? '', tagline: profile.data()!.tagline ?? '', brandColor: profile.data()!.brandColor ?? '#6d28d9',
      published: profile.data()!.published === true, quoteRequestsEnabled: profile.data()!.quoteRequestsEnabled === true, version: showcaseVersion(profile.data()) } : null };
});

async function saveContent(call: CallableRequest<unknown>, section: 'services' | 'portfolio') {
  const permission = section === 'services' ? 'services:write' : 'portfolio:manage';
  const actor = await showcaseIdentity(call.auth, permission);
  const data = showcaseInput(call.data, ['requestId', 'id', 'version', 'title', 'description', 'category', 'public', 'active', 'sortOrder', 'internalNotes', ...(section === 'portfolio' ? ['character', 'franchise', 'featured'] : [])]);
  if (!showcaseId(data.requestId) || (data.id != null && !showcaseId(data.id)) || !Number.isSafeInteger(data.version) || Number(data.version) < 0
    || !showcaseCategories.includes(String(data.category)) || typeof data.public !== 'boolean' || typeof data.active !== 'boolean'
    || !Number.isSafeInteger(data.sortOrder) || Number(data.sortOrder) < 0 || Number(data.sortOrder) > 1_000_000
    || (section === 'portfolio' && typeof data.featured !== 'boolean')) throw new HttpsError('invalid-argument', 'Revise categoria, publicação, ordem e versão do conteúdo.');
  const content = { title: text(data.title, 3, 120), description: text(data.description, 10, 2000), category: data.category,
    public: data.public, active: data.active, sortOrder: data.sortOrder, internalNotes: text(data.internalNotes ?? '', 0, 1000),
    ...(section === 'portfolio' ? { character: text(data.character ?? '', 0, 120), franchise: text(data.franchise ?? '', 0, 120), featured: data.featured } : {}) };
  if (content.public && !content.active) throw new HttpsError('invalid-argument', 'Conteúdos arquivados não podem permanecer publicados.');
  const id = typeof data.id === 'string' ? data.id : showcaseHash([call.auth!.uid, data.requestId, section]);
  const root = adminDb.doc(`ateliers/${actor.atelierId}`);
  const ref = root.collection(section).doc(id);
  const operation = root.collection('showcaseOperations').doc(showcaseHash([call.auth!.uid, data.requestId]));
  const fingerprint = showcaseHash([section, id, data.version, content]);
  return adminDb.runTransaction(async (tx) => {
    await activeShowcaseActor(tx, actor.atelierId, call.auth!.uid, permission);
    const [previous, saved] = await Promise.all([tx.get(operation), tx.get(ref)]);
    if (previous.exists) {
      if (previous.data()?.fingerprint !== fingerprint) throw new HttpsError('failed-precondition', 'A chave de repetição foi usada com outros dados.');
      return { id, version: previous.data()!.version, alreadyApplied: true };
    }
    if (data.id && !saved.exists) throw new HttpsError('not-found', 'O conteúdo não pertence a este ateliê.');
    if (showcaseVersion(saved.data()) !== data.version) throw new HttpsError('aborted', 'O conteúdo mudou. Atualize antes de salvar.');
    if (section === 'portfolio' && content.public && (!Array.isArray(saved.data()?.images) || saved.data()!.images.length === 0)) throw new HttpsError('failed-precondition', 'Adicione uma imagem antes de publicar este projeto.');
    const version = nextShowcaseVersion(Number(data.version));
    const now = Timestamp.now();
    tx.set(ref, { ...content, version, updatedAt: now, ...(!saved.exists ? { createdAt: now, ...(section === 'portfolio' ? { images: [] } : {}) } : {}) }, { merge: true });
    tx.create(operation, { fingerprint, id, version, createdAt: now });
    tx.create(adminDb.collection('auditLogs').doc(), { actorId: call.auth!.uid, atelierId: actor.atelierId, action: `showcase.${section}_saved`, entity: section, entityId: id,
      before: saved.exists ? { version: showcaseVersion(saved.data()), public: saved.data()!.public === true } : null, after: { ...content, version }, timestamp: now });
    return { id, version, alreadyApplied: false };
  });
}
export const saveAtelierService = onCall((call) => saveContent(call, 'services'));
export const saveAtelierPortfolioProject = onCall((call) => saveContent(call, 'portfolio'));

export const listPublicShowcase = onCall(async (call) => {
  const data = showcaseInput(call.data, ['tenantSlug']);
  const lookup = await lookupTenant(data.tenantSlug);
  if (lookup.status !== 'available' || !lookup.atelierId) return { status: lookup.status, services: [], projects: [] };
  const snapshots = await Promise.all(['services', 'portfolio'].map((section) => adminDb.collection(`ateliers/${lookup.atelierId}/${section}`).where('public', '==', true).limit(501).get()));
  if (snapshots.some((snapshot) => snapshot.size > 500)) throw new HttpsError('resource-exhausted', 'Este catálogo exige paginação antes de ser publicado integralmente.');
  return { status: 'available', services: sortRows(snapshots[0].docs.filter((doc) => doc.data().active !== false).map((doc) => showcasePublicProjection(doc.id, doc.data(), 'services'))),
    projects: sortRows(snapshots[1].docs.filter((doc) => doc.data().active !== false && Array.isArray(doc.data().images) && doc.data().images.length > 0).map((doc) => showcasePublicProjection(doc.id, doc.data(), 'portfolio'))) };
});

export const saveAtelierPublicProfile = onCall(async (call) => {
  const actor = await showcaseIdentity(call.auth, 'atelier:settings');
  const data = showcaseInput(call.data, ['requestId', 'version', 'name', 'tagline', 'brandColor', 'published', 'quoteRequestsEnabled']);
  if (!showcaseId(data.requestId) || !Number.isSafeInteger(data.version) || Number(data.version) < 0 || typeof data.published !== 'boolean'
    || typeof data.quoteRequestsEnabled !== 'boolean' || typeof data.brandColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(data.brandColor)) throw new HttpsError('invalid-argument', 'Revise a publicação e a identidade visual.');
  const after = { name: text(data.name, 3, 100), tagline: text(data.tagline, 0, 180), brandColor: data.brandColor.toLowerCase(), published: data.published, quoteRequestsEnabled: data.quoteRequestsEnabled };
  const ref = adminDb.doc(`publicAteliers/${actor.atelierId}`);
  const operation = adminDb.doc(`ateliers/${actor.atelierId}/showcaseOperations/${showcaseHash([call.auth!.uid, data.requestId])}`);
  const fingerprint = showcaseHash(['profile', data.version, after]);
  return adminDb.runTransaction(async (tx) => {
    const atelier = await activeShowcaseActor(tx, actor.atelierId, call.auth!.uid, 'atelier:settings');
    const [profile, previous] = await Promise.all([tx.get(ref), tx.get(operation)]);
    if (previous.exists) {
      if (previous.data()?.fingerprint !== fingerprint) throw new HttpsError('failed-precondition', 'A chave de repetição foi usada com outros dados.');
      return { version: previous.data()!.version, alreadyApplied: true };
    }
    if (!profile.exists || typeof profile.data()?.slug !== 'string') throw new HttpsError('failed-precondition', 'O endereço público deve estar configurado antes de publicar.');
    if (atelier.demoWorkspace === true && after.quoteRequestsEnabled) throw new HttpsError('failed-precondition', 'Demonstrações não podem habilitar intake público.');
    if (showcaseVersion(profile.data()) !== data.version) throw new HttpsError('aborted', 'A configuração pública mudou. Atualize a página.');
    const version = nextShowcaseVersion(Number(data.version)); const now = Timestamp.now();
    tx.update(ref, { ...after, version, updatedAt: now });
    tx.create(operation, { fingerprint, version, createdAt: now });
    tx.create(adminDb.collection('auditLogs').doc(), { actorId: call.auth!.uid, atelierId: actor.atelierId, action: 'showcase.profile_saved', entity: 'public_profile', entityId: actor.atelierId,
      before: { version: showcaseVersion(profile.data()), published: profile.data()!.published === true }, after: { ...after, version }, timestamp: now });
    return { version, alreadyApplied: false };
  });
});
