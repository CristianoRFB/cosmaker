import { describe, expect, it } from 'vitest';
import { hasValidImageSignature } from '@/repositories/quote-requests.repository';

describe('public reference image signatures', () => {
  it('accepts JPEG, PNG and WebP headers matching their declared MIME type', () => {
    expect(hasValidImageSignature('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe(true);
    expect(hasValidImageSignature('image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(hasValidImageSignature('image/webp', new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe(true);
  });

  it('rejects a MIME type that does not match the file signature', () => {
    expect(hasValidImageSignature('image/png', new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false);
    expect(hasValidImageSignature('image/svg+xml', new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBe(false);
  });
});
