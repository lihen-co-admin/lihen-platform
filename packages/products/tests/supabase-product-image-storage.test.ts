import { describe, expect, it, vi } from 'vitest';
import { ProductImageStorageWriteBlockedError, SupabaseProductImageStorage } from '../src';

const input = {
  productId: '11111111-1111-4111-8111-111111111111',
  imageId: '22222222-2222-4222-8222-222222222222',
  sha256: 'b'.repeat(64),
  mimeType: 'image/jpeg' as const,
  byteSize: 1024,
  body: new Uint8Array([1, 2, 3]),
};

describe('SupabaseProductImageStorage', () => {
  it('blocks original uploads by default before touching Storage', async () => {
    const from = vi.fn();
    const storage = new SupabaseProductImageStorage({ storage: { from } } as never);
    await expect(storage.uploadOriginal(input)).rejects.toBeInstanceOf(ProductImageStorageWriteBlockedError);
    expect(from).not.toHaveBeenCalled();
  });

  it('uses immutable upload semantics when explicitly enabled', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upload });
    const storage = new SupabaseProductImageStorage({ storage: { from } } as never, { originalUploadEnabled: true });
    await storage.uploadOriginal(input);
    expect(upload).toHaveBeenCalledWith(expect.stringContaining('/original/'), input.body, {
      contentType: 'image/jpeg',
      upsert: false,
    });
  });
});
