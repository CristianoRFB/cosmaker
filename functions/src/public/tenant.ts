import { randomBytes, randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { orderFileHash } from '../orders/order-file-storage';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxReferenceSize = 10 * 1024 * 1024;
const maxReferenceFiles = 5;
const validCategories = new Set(['full_cosplay', 'wig', 'armor', 'prop', 'accessory', 'other']);

type TenantStatus = 'available' | 'unpublished' | 'suspended' | 'not_found' | 'invalid_slug';

interface TenantLookup {
  status: TenantStatus;
  atelierId?: string;
  tenant?: {
    slug: string;
    name?: string;
    tagline?: string;
    brandColor?: string;
    published: boolean;
    quoteRequestsEnabled: boolean;
  };
}

function normalizeSlug(value: unknown) {
  if (typeof value !== 'string') return null;
  const slug = value.trim();
  return slug.length <= 63 && slugPattern.test(slug) ? slug : null;
}

export async function lookupTenant(tenantSlug: unknown): Promise<TenantLookup> {
  const slug = normalizeSlug(tenantSlug);
  if (!slug) return { status: 'invalid_slug' };

  const slugSnapshot = await adminDb.doc(`publicAtelierSlugs/${slug}`).get();
  if (!slugSnapshot.exists) return { status: 'not_found' };
  const slugData = slugSnapshot.data()!;
  const atelierId = typeof slugData.atelierId === 'string' ? slugData.atelierId : '';
  if (!atelierId || atelierId.includes('/') || slugData.slug !== slug) return { status: 'not_found' };

  const [atelierSnapshot, publicSnapshot] = await Promise.all([
    adminDb.doc(`ateliers/${atelierId}`).get(),
    adminDb.doc(`publicAteliers/${atelierId}`).get(),
  ]);
  if (!atelierSnapshot.exists) return { status: 'not_found' };
  if (atelierSnapshot.data()?.active !== true) return { status: 'suspended' };
  if (!publicSnapshot.exists) return { status: 'unpublished' };

  const publicData = publicSnapshot.data()!;
  if (publicData.slug !== slug) return { status: 'not_found' };
  const published = publicData.published === true;
  const quoteRequestsEnabled = publicData.quoteRequestsEnabled === true;
  const tenant = {
    slug,
    ...(typeof publicData.name === 'string' && publicData.name.trim() ? { name: publicData.name.trim().slice(0, 100) } : {}),
    ...(typeof publicData.tagline === 'string' && publicData.tagline.trim() ? { tagline: publicData.tagline.trim().slice(0, 180) } : {}),
    ...(typeof publicData.brandColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(publicData.brandColor) ? { brandColor: publicData.brandColor } : {}),
    published,
    quoteRequestsEnabled,
  };

  return {
    status: published ? 'available' : 'unpublished',
    atelierId,
    tenant,
  };
}

export const resolvePublicTenant = onCall(async (call) => {
  const lookup = await lookupTenant(call.data?.tenantSlug);
  if (lookup.status !== 'available' || !lookup.tenant) return { status: lookup.status };
  return { status: lookup.status, tenant: lookup.tenant };
});

function readText(data: Record<string, unknown>, key: string, minimum: number, maximum: number): string;
function readText(data: Record<string, unknown>, key: string, minimum: number, maximum: number, optional: true): string | undefined;
function readText(data: Record<string, unknown>, key: string, minimum: number, maximum: number, optional = false): string | undefined {
  const value = data[key];
  if (optional && (value === undefined || value === null || value === '')) return undefined;
  if (typeof value !== 'string') throw new HttpsError('invalid-argument', `O campo ${key} é inválido.`);
  const trimmed = value.trim();
  if (trimmed.length < minimum || trimmed.length > maximum) throw new HttpsError('invalid-argument', `O campo ${key} é inválido.`);
  return trimmed;
}

function readDate(data: Record<string, unknown>, key: string, optional = false) {
  const value = data[key];
  if (optional && (value === undefined || value === null || value === '')) return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpsError('invalid-argument', `A data informada em ${key} é inválida.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new HttpsError('invalid-argument', `A data informada em ${key} é inválida.`);
  return value;
}

function validateQuoteInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpsError('invalid-argument', 'Os dados do formulário são inválidos.');
  const data = value as Record<string, unknown>;
  if ('atelierId' in data) throw new HttpsError('invalid-argument', 'O ateliê é resolvido pelo endereço público.');
  const email = readText(data, 'email', 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'Informe um e-mail válido.');
  const category = data.category;
  if (typeof category !== 'string' || !validCategories.has(category)) throw new HttpsError('invalid-argument', 'A categoria informada é inválida.');
  const urgency = data.urgency;
  if (urgency !== 'normal' && urgency !== 'urgent') throw new HttpsError('invalid-argument', 'A urgência informada é inválida.');

  const budgetMin = data.budgetMin === undefined || data.budgetMin === '' ? undefined : Number(data.budgetMin);
  const budgetMax = data.budgetMax === undefined || data.budgetMax === '' ? undefined : Number(data.budgetMax);
  if (budgetMin !== undefined && (!Number.isFinite(budgetMin) || budgetMin < 0)) throw new HttpsError('invalid-argument', 'O investimento mínimo é inválido.');
  if (budgetMax !== undefined && (!Number.isFinite(budgetMax) || budgetMax < 0)) throw new HttpsError('invalid-argument', 'O investimento máximo é inválido.');
  if (budgetMin !== undefined && budgetMax !== undefined && budgetMin > budgetMax) throw new HttpsError('invalid-argument', 'O investimento mínimo não pode superar o máximo.');

  const phone = readText(data, 'phone', 1, 30, true);
  const eventDate = readDate(data, 'eventDate', true);
  const observations = readText(data, 'observations', 1, 1000, true);

  return {
    clientId: null,
    name: readText(data, 'name', 2, 100),
    email,
    ...(phone ? { phone } : {}),
    character: readText(data, 'character', 2, 120),
    franchise: readText(data, 'franchise', 2, 120),
    category,
    description: readText(data, 'description', 20, 2000),
    ...(eventDate ? { eventDate } : {}),
    desiredDeliveryDate: readDate(data, 'desiredDeliveryDate'),
    ...(budgetMin !== undefined ? { budgetMin } : {}),
    ...(budgetMax !== undefined ? { budgetMax } : {}),
    urgency,
    ...(observations ? { observations } : {}),
    status: 'new',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

interface ReferenceDescriptor { name: string; contentType: string; size: number; sha256: string; }

function validateReferenceDescriptors(value: unknown): ReferenceDescriptor[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxReferenceFiles) throw new HttpsError('invalid-argument', `Anexe no máximo ${maxReferenceFiles} imagens.`);
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new HttpsError('invalid-argument', 'Uma referência é inválida.');
    const data = entry as Record<string, unknown>;
    if (Object.keys(data).some(key => !['name', 'contentType', 'size', 'sha256'].includes(key))) throw new HttpsError('invalid-argument', 'A referência contém campos inválidos.');
    const name = readText(data, 'name', 1, 180);
    if (/[\x00-\x1f\x7f]/.test(name)) throw new HttpsError('invalid-argument', 'O nome da referência é inválido.');
    const contentType = data.contentType;
    const size = data.size;
    if (typeof contentType !== 'string' || !allowedImageTypes.has(contentType)) throw new HttpsError('invalid-argument', 'Use imagens JPEG, PNG ou WebP.');
    if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0 || size > maxReferenceSize) throw new HttpsError('invalid-argument', 'Cada imagem pode ter até 10 MB.');
    if (typeof data.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(data.sha256)) throw new HttpsError('invalid-argument', 'O hash da referência é inválido.');
    return { name, contentType, size, sha256: data.sha256 };
  });
}

export function assertIntakeAvailable(lookup: TenantLookup) {
  if (lookup.status === 'invalid_slug') throw new HttpsError('invalid-argument', 'O endereço público do ateliê é inválido.');
  if (lookup.status === 'not_found' || lookup.status === 'unpublished') throw new HttpsError('not-found', 'Este ateliê não está disponível para solicitações públicas.');
  if (lookup.status === 'suspended') throw new HttpsError('failed-precondition', 'Este ateliê está temporariamente suspenso.');
  if (!lookup.tenant?.published || !lookup.tenant.quoteRequestsEnabled || !lookup.atelierId) {
    throw new HttpsError('failed-precondition', 'Este ateliê não está recebendo solicitações no momento.');
  }
  return lookup.atelierId;
}

export const createPublicQuoteRequest = onCall(async (call) => {
  if (call.data && typeof call.data === 'object' && 'atelierId' in call.data) {
    throw new HttpsError('invalid-argument', 'O ateliê é resolvido pelo endereço público.');
  }
  const lookup = await lookupTenant(call.data?.tenantSlug);
  const atelierId = assertIntakeAvailable(lookup);
  const quoteRequest = validateQuoteInput(call.data?.input);
  const descriptors = validateReferenceDescriptors(call.data?.references);
  const requestRef = adminDb.collection('ateliers').doc(atelierId).collection('quoteRequests').doc();
  const references = descriptors.map(() => {
    const uploadId = randomUUID();
    return { uploadId, storagePath: `ateliers/${atelierId}/quoteRequests/${requestRef.id}/references/${uploadId}`, capability: randomBytes(32).toString('hex'), expiresAtMs: Date.now() + 15 * 60_000 };
  });
  await adminDb.runTransaction(async (transaction) => {
    const [atelier, publicProfile, slug] = await Promise.all([
      transaction.get(adminDb.doc(`ateliers/${atelierId}`)), transaction.get(adminDb.doc(`publicAteliers/${atelierId}`)),
      transaction.get(adminDb.doc(`publicAtelierSlugs/${lookup.tenant!.slug}`)),
    ]);
    if (atelier.data()?.active !== true || atelier.data()?.demoWorkspace === true || publicProfile.data()?.published !== true
      || publicProfile.data()?.quoteRequestsEnabled !== true || publicProfile.data()?.slug !== lookup.tenant!.slug || slug.data()?.atelierId !== atelierId) {
      throw new HttpsError('failed-precondition', 'O ateliê não está recebendo solicitações neste endereço.');
    }
    const showcaseContext: Record<string, { id: string; title: string }> = {};
    for (const [field, section, key] of [['serviceId', 'services', 'service'], ['projectId', 'portfolio', 'project']] as const) {
      const id = call.data?.input?.[field];
      if (id === undefined || id === null || id === '') continue;
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(id)) throw new HttpsError('invalid-argument', 'A referência comercial é inválida.');
      const content = await transaction.get(adminDb.doc(`ateliers/${atelierId}/${section}/${id}`));
      if (!content.exists || content.data()?.public !== true || content.data()?.active === false || typeof content.data()?.title !== 'string'
        || (key === 'project' && (!Array.isArray(content.data()?.images) || !content.data()!.images.length))) {
        throw new HttpsError('not-found', 'A referência comercial não está publicada neste ateliê.');
      }
      showcaseContext[key] = { id, title: content.data()!.title.slice(0, 120) };
    }
    transaction.create(requestRef, { ...quoteRequest, ...(Object.keys(showcaseContext).length ? { showcaseContext } : {}) });
    references.forEach((reference, index) => transaction.create(requestRef.collection('references').doc(reference.uploadId), {
      storagePath: reference.storagePath, originalName: descriptors[index].name, contentType: descriptors[index].contentType,
      size: descriptors[index].size, sha256: descriptors[index].sha256, uploadStatus: 'pending', createdAt: FieldValue.serverTimestamp(),
      uploadCapabilityHash: orderFileHash(Buffer.from(reference.capability)), uploadExpiresAtMs: reference.expiresAtMs, uploadSlug: lookup.tenant!.slug,
    }));
  });
  return { requestId: requestRef.id, references };
});

// Deprecated public mutation endpoints cannot complete or delete server-managed or legacy objects.
// Existing ready references remain available through the authenticated byte reader.
export const completePublicQuoteReferenceUpload = onCall(() => {
  throw new HttpsError('failed-precondition', 'Envie a referência pelo transporte protegido.');
});
export const discardPublicQuoteReferenceUpload = onCall(() => ({ discarded: false }));
