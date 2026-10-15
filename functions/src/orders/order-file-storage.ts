import { createHash, randomUUID } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import { adminStorage } from '../admin';

export const orderFileMaxBytes = 20 * 1024 * 1024;
export const orderFileTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
export function orderFileHash(bytes: Buffer) { return createHash('sha256').update(bytes).digest('hex'); }
export function orderFilePath(atelierId: string, orderId: string, fileId: string) { return `ateliers/${atelierId}/orders/${orderId}/attachments/${fileId}`; }
export function validOrderFileBytes(bytes: Buffer, type: string) {
  if (!orderFileTypes.has(type) || bytes.length < 1 || bytes.length > orderFileMaxBytes) return false;
  if (type === 'application/pdf') return bytes.toString('ascii', 0, 5) === '%PDF-';
  if (type === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

/** Old public URLs must be revoked; new attachments use authenticated server bytes only. */
export async function revokeOrderFileTokens(path: string) {
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  if (emulatorHost && (process.env.FUNCTIONS_EMULATOR !== 'true' || !/^(127\.0\.0\.1|localhost|\[::1\]):\d{1,5}$/.test(emulatorHost) || Number(emulatorHost.split(':').at(-1)) > 65535)) {
    throw new HttpsError('failed-precondition', 'A revogação local exige o Storage Emulator no próprio computador.');
  }
  const bucket = adminStorage.bucket();
  const object = bucket.file(path);
  let metadata;
  try { [metadata] = await object.getMetadata(); }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && Number(error.code) === 404) return;
    throw new HttpsError('unavailable', 'Não foi possível verificar os links anteriores deste arquivo. Tente novamente.');
  }
  const tokens = typeof metadata.metadata?.firebaseStorageDownloadTokens === 'string' ? metadata.metadata.firebaseStorageDownloadTokens.split(',').filter(Boolean) : [];
  try {
    if (emulatorHost && tokens.length) {
      // Emulator metadata appends tokens, and deleting its last token generates a new one.
      // Add an undisclosed replacement before explicitly deleting all previously known tokens.
      await object.setMetadata({ cacheControl: 'private, no-store', metadata: { ...metadata.metadata, firebaseStorageDownloadTokens: randomUUID() } });
      for (const token of tokens) {
        const endpoint = `http://${emulatorHost}/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(path)}?delete_token=${encodeURIComponent(token)}`;
        const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: 'Bearer owner' }, signal: AbortSignal.timeout(10_000) });
        if (!response.ok && response.status !== 404) throw new Error('Storage Emulator token revocation failed.');
      }
    } else {
      await object.setMetadata({ cacheControl: 'private, no-store', metadata: { ...metadata.metadata, firebaseStorageDownloadTokens: null } });
    }
  } catch { throw new HttpsError('unavailable', 'Não foi possível revogar os links anteriores deste arquivo. Tente novamente.'); }
}
