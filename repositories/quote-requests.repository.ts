'use client';

import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
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

function safeFileName(name: string) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100) || 'referencia';
}

export async function createPublicQuoteRequest(atelierId: string, input: QuoteRequestFormData, files: File[] = []) {
  const { db, storage } = requireFirebase();
  const requestData = {
    clientId: null,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
    character: input.character.trim(),
    franchise: input.franchise.trim(),
    category: input.category,
    description: input.description.trim(),
    ...(input.eventDate ? { eventDate: input.eventDate } : {}),
    desiredDeliveryDate: input.desiredDeliveryDate,
    ...(input.budgetMin ? { budgetMin: Number(input.budgetMin) } : {}),
    ...(input.budgetMax ? { budgetMax: Number(input.budgetMax) } : {}),
    urgency: input.urgency,
    ...(input.observations?.trim() ? { observations: input.observations.trim() } : {}),
    status: 'new',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const requestRef = await addDoc(collection(db, 'ateliers', atelierId, 'quoteRequests'), requestData);

  const outcomes = await Promise.all(files.map(async (file) => {
    try {
      const referenceId = crypto.randomUUID();
      const storagePath = `ateliers/${atelierId}/quoteRequests/${requestRef.id}/references/${referenceId}-${safeFileName(file.name)}`;
      await uploadBytes(ref(storage, storagePath), file, { contentType: file.type, customMetadata: { requestId: requestRef.id } });
      await setDoc(doc(db, 'ateliers', atelierId, 'quoteRequests', requestRef.id, 'references', referenceId), {
        storagePath,
        originalName: file.name,
        contentType: file.type,
        size: file.size,
        createdAt: serverTimestamp(),
      });
      return null;
    } catch {
      return file.name;
    }
  }));

  return { requestId: requestRef.id, failedFiles: outcomes.filter((name): name is string => name !== null) };
}
