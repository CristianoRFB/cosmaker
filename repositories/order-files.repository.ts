import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { OrderFile } from '@/types/order';

export async function listOrderFiles(atelierId: string, orderId: string) {
  const { functions } = requireFirebase();
  const result = await httpsCallable<{ atelierId: string; orderId: string }, { files: OrderFile[] }>(functions, 'listOrderFiles')({ atelierId, orderId });
  return result.data.files;
}

export async function uploadOrderFile(input: { atelierId: string; orderId: string; file: File; category: NonNullable<OrderFile['category']>; visibleToClient: boolean; requestId: string }) {
  const { functions } = requireFirebase();
  const digest = await crypto.subtle.digest('SHA-256', await input.file.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const create = await httpsCallable<Record<string, unknown>, { fileId: string; storagePath: string; status: string; alreadyCreated: boolean }>(functions, 'createOrderFileUpload')({
    atelierId: input.atelierId, orderId: input.orderId, requestId: input.requestId,
    originalName: input.file.name, contentType: input.file.type, size: input.file.size,
    category: input.category, visibleToClient: input.visibleToClient,
    sha256,
  });
  const response = await authenticatedFileRequest('uploadOrderFileBytes', input.atelierId, input.orderId, create.data.fileId, {
    method: 'POST', body: input.file, headers: { 'Content-Type': input.file.type },
  });
  return response.json();
}

export async function updateOrderFileAccess(input: { atelierId: string; orderId: string; fileId: string; expectedRevision: number; visibleToClient: boolean; archived: boolean; requestId: string }) {
  const { functions } = requireFirebase();
  return (await httpsCallable(functions, 'updateOrderFileAccess')(input)).data;
}

async function authenticatedFileRequest(name: string, atelierId: string, orderId: string, fileId: string, options: RequestInit = {}) {
  const { app, auth } = requireFirebase();
  const user = auth.currentUser;
  if (!app || !user) throw new Error('Entre na sua conta para acessar arquivos.');
  const projectId = app.options.projectId;
  const region = 'us-central1';
  const base = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true'
    ? `http://${process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1'}:${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT || '5001'}/${projectId}/${region}`
    : `https://${region}-${projectId}.cloudfunctions.net`;
  const url = new URL(`${base}/${name}`);
  url.searchParams.set('atelierId', atelierId); url.searchParams.set('orderId', orderId); url.searchParams.set('fileId', fileId);
  const response = await fetch(url, { ...options, cache: 'no-store', headers: { ...options.headers, Authorization: `Bearer ${await user.getIdToken()}` } });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string; code?: string; details?: unknown } } | null;
    throw Object.assign(new Error(payload?.error?.message || 'Não foi possível acessar o arquivo. Tente novamente.'), { code: `functions/${payload?.error?.code || 'unknown'}`, details: payload?.error?.details });
  }
  return response;
}

export async function downloadOrderFile(atelierId: string, orderId: string, file: OrderFile) {
  const response = await authenticatedFileRequest('downloadOrderFileBytes', atelierId, orderId, file.id);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = file.originalName; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
