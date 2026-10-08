'use client';

import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes } from 'firebase/storage';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { QuoteRequestFormData } from '@/schemas/quote-request.schema';

export const MAX_REFERENCE_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_REFERENCE_FILES = 5;
export const ALLOWED_REFERENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export interface ReferenceUploadIssue { fileName: string; message: string; }

export function validateReferenceFiles(files: File[]) {
  const issues: ReferenceUploadIssue[] = [];
  if (files.length > MAX_REFERENCE_FILES) issues.push({ fileName: '', message: `Anexe no máximo ${MAX_REFERENCE_FILES} imagens.` });
  for (const file of files.slice(0, MAX_REFERENCE_FILES)) {
    if (!(ALLOWED_REFERENCE_TYPES as readonly string[]).includes(file.type)) issues.push({ fileName: file.name, message: 'Use imagens JPEG, PNG ou WebP.' });
    if (file.size > MAX_REFERENCE_FILE_SIZE) issues.push({ fileName: file.name, message: 'Cada imagem pode ter até 10 MB.' });
    if (file.size === 0) issues.push({ fileName: file.name, message: 'O arquivo está vazio.' });
  }
  return issues;
}

export function hasValidImageSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === 'image/png') return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (contentType === 'image/webp') return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return false;
}

export async function validateReferenceFileSignatures(files: File[]) {
  const issues: ReferenceUploadIssue[] = [];
  await Promise.all(files.map(async (file) => {
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!hasValidImageSignature(file.type, header)) {
      issues.push({ fileName: file.name, message: 'O conteúdo não corresponde ao formato da imagem informado.' });
    }
  }));
  return issues;
}

interface CreatePublicRequestResponse {
  requestId: string;
  references: Array<{ uploadId: string; storagePath: string }>;
}

export async function createPublicQuoteRequest(tenantSlug: string, input: QuoteRequestFormData, files: File[] = []) {
  const { functions, storage } = requireFirebase();
  const createRequest = httpsCallable<{
    tenantSlug: string;
    input: Record<string, unknown>;
    references: Array<{ name: string; contentType: string; size: number }>;
  }, CreatePublicRequestResponse>(functions, 'createPublicQuoteRequest');
  const completeUpload = httpsCallable<{ tenantSlug: string; requestId: string; uploadId: string }, { uploadId: string; ready: boolean }>(functions, 'completePublicQuoteReferenceUpload');
  const discardUpload = httpsCallable<{ tenantSlug: string; requestId: string; uploadId: string }, { discarded: boolean }>(functions, 'discardPublicQuoteReferenceUpload');

  const requestInput = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== ''));
  const result = await createRequest({
    tenantSlug,
    input: requestInput,
    references: files.map((file) => ({ name: file.name, contentType: file.type, size: file.size })),
  });
  const { requestId, references } = result.data;

  const outcomes = await Promise.all(files.map(async (file, index) => {
    const reference = references[index];
    if (!reference) return file.name;
    try {
      await uploadBytes(ref(storage, reference.storagePath), file, {
        contentType: file.type,
        customMetadata: { requestId, uploadId: reference.uploadId },
      });
      await completeUpload({ tenantSlug, requestId, uploadId: reference.uploadId });
      return null;
    } catch {
      await discardUpload({ tenantSlug, requestId, uploadId: reference.uploadId }).catch(() => undefined);
      return file.name;
    }
  }));

  return { requestId, failedFiles: outcomes.filter((name): name is string => name !== null) };
}
