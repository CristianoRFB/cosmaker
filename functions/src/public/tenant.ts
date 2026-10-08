import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb, adminStorage } from '../admin';

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

async function lookupTenant(tenantSlug: unknown): Promise<TenantLookup> {
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

interface ReferenceDescriptor { name: string; contentType: string; size: number; }

function validateReferenceDescriptors(value: unknown): ReferenceDescriptor[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxReferenceFiles) throw new HttpsError('invalid-argument', `Anexe no máximo ${maxReferenceFiles} imagens.`);
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new HttpsError('invalid-argument', 'Uma referência é inválida.');
    const data = entry as Record<string, unknown>;
    const name = readText(data, 'name', 1, 255);
    const contentType = data.contentType;
    const size = data.size;
    if (typeof contentType !== 'string' || !allowedImageTypes.has(contentType)) throw new HttpsError('invalid-argument', 'Use imagens JPEG, PNG ou WebP.');
    if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0 || size > maxReferenceSize) throw new HttpsError('invalid-argument', 'Cada imagem pode ter até 10 MB.');
    return { name, contentType, size };
  });
}

function assertIntakeAvailable(lookup: TenantLookup) {
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
  const batch = adminDb.batch();
  batch.create(requestRef, quoteRequest);

  const references = descriptors.map((descriptor) => {
    const uploadId = randomUUID();
    const storagePath = `ateliers/${atelierId}/quoteRequests/${requestRef.id}/references/${uploadId}`;
    batch.create(requestRef.collection('references').doc(uploadId), {
      storagePath,
      originalName: descriptor.name,
      contentType: descriptor.contentType,
      size: descriptor.size,
      uploadStatus: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });
    return { uploadId, storagePath };
  });

  await batch.commit();
  return { requestId: requestRef.id, references };
});

function hasValidImageSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === 'image/png') return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (contentType === 'image/webp') return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return false;
}

export const completePublicQuoteReferenceUpload = onCall(async (call) => {
  const lookup = await lookupTenant(call.data?.tenantSlug);
  const atelierId = assertIntakeAvailable(lookup);
  const requestId = typeof call.data?.requestId === 'string' ? call.data.requestId : '';
  const uploadId = typeof call.data?.uploadId === 'string' ? call.data.uploadId : '';
  if (!/^[A-Za-z0-9_-]{10,150}$/.test(requestId) || !/^[0-9a-f-]{36}$/i.test(uploadId)) {
    throw new HttpsError('invalid-argument', 'A referência enviada é inválida.');
  }

  const requestRef = adminDb.doc(`ateliers/${atelierId}/quoteRequests/${requestId}`);
  const referenceRef = requestRef.collection('references').doc(uploadId);
  const [requestSnapshot, referenceSnapshot] = await Promise.all([requestRef.get(), referenceRef.get()]);
  if (!requestSnapshot.exists || requestSnapshot.data()?.status !== 'new' || !referenceSnapshot.exists) {
    throw new HttpsError('not-found', 'A solicitação ou a referência não está disponível.');
  }
  const reference = referenceSnapshot.data()!;
  const expectedPath = `ateliers/${atelierId}/quoteRequests/${requestId}/references/${uploadId}`;
  if (reference.uploadStatus !== 'pending' || reference.storagePath !== expectedPath || !allowedImageTypes.has(reference.contentType)) {
    throw new HttpsError('failed-precondition', 'A referência não está aguardando validação.');
  }

  const file = adminStorage.bucket().file(expectedPath);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError('not-found', 'O arquivo de referência não foi encontrado.');
  const [metadata] = await file.getMetadata();
  const actualSize = Number(metadata.size);
  const actualType = metadata.contentType;
  if (actualSize !== reference.size || actualSize <= 0 || actualSize > maxReferenceSize || actualType !== reference.contentType) {
    await Promise.all([file.delete({ ignoreNotFound: true }), referenceRef.delete()]);
    throw new HttpsError('invalid-argument', 'O arquivo não corresponde ao tipo ou tamanho informado.');
  }

  const [content] = await file.download();
  if (!hasValidImageSignature(reference.contentType, content)) {
    await Promise.all([file.delete({ ignoreNotFound: true }), referenceRef.delete()]);
    throw new HttpsError('invalid-argument', 'O conteúdo da imagem não corresponde ao formato informado.');
  }

  await referenceRef.update({ uploadStatus: 'ready', validatedAt: FieldValue.serverTimestamp() });
  return { uploadId, ready: true };
});

export const discardPublicQuoteReferenceUpload = onCall(async (call) => {
  const lookup = await lookupTenant(call.data?.tenantSlug);
  const atelierId = lookup.atelierId;
  const requestId = typeof call.data?.requestId === 'string' ? call.data.requestId : '';
  const uploadId = typeof call.data?.uploadId === 'string' ? call.data.uploadId : '';
  if (!atelierId || !/^[A-Za-z0-9_-]{10,150}$/.test(requestId) || !/^[0-9a-f-]{36}$/i.test(uploadId)) {
    return { discarded: false };
  }

  const requestRef = adminDb.doc(`ateliers/${atelierId}/quoteRequests/${requestId}`);
  const referenceRef = requestRef.collection('references').doc(uploadId);
  const referenceSnapshot = await referenceRef.get();
  if (!referenceSnapshot.exists || referenceSnapshot.data()?.uploadStatus !== 'pending') return { discarded: false };
  const expectedPath = `ateliers/${atelierId}/quoteRequests/${requestId}/references/${uploadId}`;
  await Promise.all([
    adminStorage.bucket().file(expectedPath).delete({ ignoreNotFound: true }),
    referenceRef.delete(),
  ]);
  return { discarded: true };
});
