'use client';

import { httpsCallable } from 'firebase/functions';
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
    if (file.name.trim().length > 180 || !file.name.trim() || /[\x00-\x1f\x7f]/.test(file.name)) issues.push({ fileName: file.name, message: 'Use um nome de arquivo válido de até 180 caracteres.' });
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
  references: Array<{ uploadId: string; storagePath: string; capability: string; expiresAtMs: number }>;
}

export async function createPublicQuoteRequest(tenantSlug: string, input: QuoteRequestFormData, files: File[] = []) {
  const { functions, app } = requireFirebase();
  if (!app) throw new Error('O serviço de referências está indisponível.');
  const createRequest = httpsCallable<{
    tenantSlug: string;
    input: Record<string, unknown>;
    references: Array<{ name: string; contentType: string; size: number; sha256: string }>;
  }, CreatePublicRequestResponse>(functions, 'createPublicQuoteRequest');

  const requestInput = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== ''));
  const result = await createRequest({
    tenantSlug,
    input: requestInput,
    references: await Promise.all(files.map(async (file) => ({ name: file.name, contentType: file.type, size: file.size,
      sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join(''),
    }))),
  });
  const { requestId, references } = result.data;

  const outcomes = await Promise.all(files.map(async (file, index) => {
    const reference = references[index];
    if (!reference) return file.name;
    try {
      const region = 'us-central1';
      const base = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true'
        ? `http://${process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1'}:${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT || '5001'}/${app.options.projectId}/${region}`
        : `https://${region}-${app.options.projectId}.cloudfunctions.net`;
      const url = new URL(`${base}/uploadPublicQuoteReferenceBytes`);
      url.searchParams.set('tenantSlug', tenantSlug); url.searchParams.set('requestId', requestId); url.searchParams.set('uploadId', reference.uploadId);
      // A lost response can safely retry the same capability and identical bytes once.
      for (let attempt = 0; ; attempt++) {
        try {
          const response = await fetch(url, { method: 'POST', body: file, cache: 'no-store', signal: AbortSignal.timeout(120_000), headers: { 'Content-Type': file.type, Authorization: `Bearer ${reference.capability}` } });
          if (!response.ok) {
            if (attempt === 0 && (response.status === 409 || response.status >= 500)) continue;
            throw new Error('Não foi possível enviar a referência.');
          }
          break;
        } catch (error) { if (attempt === 0) continue; throw error; }
      }
      return null;
    } catch {
      return file.name;
    }
  }));

  return { requestId, failedFiles: outcomes.filter((name): name is string => name !== null) };
}
