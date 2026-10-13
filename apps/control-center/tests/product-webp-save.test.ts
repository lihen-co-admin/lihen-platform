import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import type { ProductImageDTO } from '@lihen/products';
import {
  saveProductWebpQueue,
  type ProductWebpProgress,
} from '../src/composition/product-webp-save';

const productId = '11111111-1111-4111-8111-111111111111';
const ownerId = '22222222-2222-4222-8222-222222222222';
const key = createHash('sha256').update('webp').digest('hex');
const imageId = '33333333-3333-4333-8333-333333333333';
const file = new File(['webp'], 'sample.webp', { type: 'image/webp' });
const candidate = { key, file };
const image: ProductImageDTO = {
  id: imageId,
  productId,
  publicUrl: 'https://example.invalid/sample.webp',
  isMain: true,
  sortOrder: 0,
  sourceType: 'STORAGE',
};

describe('Product Master WebP save flow', () => {
  it('uploads, registers and confirms readback before succeeding', async () => {
    const upload = vi.fn(async () => ({
      imageId,
      sha256: key,
      operationKey: 'operation-1',
      ownerId,
    }));
    const register = vi.fn(async () => {});
    const readBack = vi.fn(async () => [image]);
    const onProgress = vi.fn();

    await expect(
      saveProductWebpQueue({
        productId,
        ownerId,
        candidates: [candidate],
        registeredCount: 0,
        progress: [],
        upload,
        register,
        onProgress,
        readBack,
      }),
    ).resolves.toEqual([image]);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        productId,
        ownerId,
        imageId,
        sha256: key,
        makeMain: true,
      }),
    );
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(readBack).toHaveBeenCalledWith(productId);
  });

  it('retains the confirmed upload after RPC failure and retries registration only', async () => {
    const upload = vi.fn(async () => ({
      imageId,
      sha256: key,
      operationKey: 'stable-operation',
      ownerId,
    }));
    const register = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('RPC temporarily failed'))
      .mockResolvedValueOnce();
    const onProgress = vi.fn();
    const readBack = vi.fn(async () => [image]);
    const progress: ProductWebpProgress[] = [];

    await expect(
      saveProductWebpQueue({
        productId,
        ownerId,
        candidates: [candidate],
        registeredCount: 0,
        progress,
        upload,
        register,
        onProgress: (entry) => {
          onProgress(entry);
          const index = progress.findIndex((value) => value.key === entry.key);
          if (index < 0) progress.push(entry);
          else progress[index] = entry;
        },
        readBack,
      }),
    ).rejects.toThrow('RPC temporarily failed');

    expect(progress[0]).toMatchObject({
      productId,
      ownerId,
      imageId,
      sha256: key,
      operationKey: 'stable-operation',
      status: 'UPLOADED',
    });
    await expect(
      saveProductWebpQueue({
        productId,
        ownerId,
        candidates: [candidate],
        registeredCount: 0,
        progress,
        upload,
        register,
        onProgress: (entry) => {
          const index = progress.findIndex((value) => value.key === entry.key);
          if (index < 0) progress.push(entry);
          else progress[index] = entry;
        },
        readBack,
      }),
    ).resolves.toEqual([image]);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledTimes(2);
    expect(register.mock.calls[0]?.[0]).toMatchObject({ operationKey: 'stable-operation' });
    expect(register.mock.calls[1]?.[0]).toMatchObject({ operationKey: 'stable-operation' });
  });

  it.each([
    {
      label: 'different user',
      ownerId: '44444444-4444-4444-8444-444444444444',
      productId,
    },
    {
      label: 'different product',
      ownerId,
      productId: '55555555-5555-4555-8555-555555555555',
    },
  ])(
    'does not reuse a pending upload for a $label',
    async ({ ownerId: retryOwnerId, productId: retryProductId }) => {
      const pending: ProductWebpProgress = {
        key,
        productId,
        ownerId,
        imageId,
        sha256: key,
        operationKey: 'operation-1',
        altText: 'sample',
        makeMain: true,
        status: 'UPLOADED',
      };
      const upload = vi.fn();
      const register = vi.fn();
      const readBack = vi.fn();

      await expect(
        saveProductWebpQueue({
          productId: retryProductId,
          ownerId: retryOwnerId,
          candidates: [candidate],
          registeredCount: 0,
          progress: [pending],
          upload,
          register,
          onProgress: vi.fn(),
          readBack,
        }),
      ).rejects.toThrow('otro producto o usuario');
      expect(upload).not.toHaveBeenCalled();
      expect(register).not.toHaveBeenCalled();
      expect(readBack).not.toHaveBeenCalled();
    },
  );

  it('does not reuse a pending upload when the file bytes change', async () => {
    const upload = vi.fn();
    await expect(
      saveProductWebpQueue({
        productId,
        ownerId,
        candidates: [{ key, file: new File(['different'], 'sample.webp', { type: 'image/webp' }) }],
        registeredCount: 0,
        progress: [],
        upload,
        register: vi.fn(),
        onProgress: vi.fn(),
        readBack: vi.fn(),
      }),
    ).rejects.toThrow('El archivo cambió');
    expect(upload).not.toHaveBeenCalled();
  });

  it('does not report success if Product Master readback omits the registered image', async () => {
    await expect(
      saveProductWebpQueue({
        productId,
        ownerId,
        candidates: [candidate],
        registeredCount: 0,
        progress: [],
        upload: async () => ({
          imageId,
          sha256: key,
          operationKey: 'operation-1',
          ownerId,
        }),
        register: async () => {},
        onProgress: vi.fn(),
        readBack: async () => [],
      }),
    ).rejects.toThrow('no aparece en la lectura posterior');
  });
  it.each(['readback', 'partial batch'])(
    'retries %s without repeating confirmed uploads or registrations',
    async (scenario) => {
      const secondKey = createHash('sha256').update('second').digest('hex');
      const secondId = '66666666-6666-4666-8666-666666666666';
      const candidates =
        scenario === 'partial batch'
          ? [
              candidate,
              { key: secondKey, file: new File(['second'], 'second.webp', { type: 'image/webp' }) },
            ]
          : [candidate];
      const progress: ProductWebpProgress[] = [];
      const upload = vi.fn(async (_productId: string, next: File) => ({
        imageId: next === file ? imageId : secondId,
        sha256: next === file ? key : secondKey,
        operationKey: next === file ? 'stable-first' : 'stable-second',
        ownerId,
      }));
      let failed = false;
      const register = vi.fn(async (entry: ProductWebpProgress) => {
        if (scenario === 'partial batch' && entry.imageId === secondId && !failed) {
          failed = true;
          throw new Error('temporary failure');
        }
      });
      const expected =
        scenario === 'partial batch' ? [image, { ...image, id: secondId, isMain: false }] : [image];
      const readBack = vi.fn(async () => {
        if (scenario === 'readback' && !failed) {
          failed = true;
          throw new Error('temporary failure');
        }
        return expected;
      });
      const input = {
        productId,
        ownerId,
        candidates,
        registeredCount: 0,
        progress,
        upload,
        register,
        readBack,
        onProgress: (entry: ProductWebpProgress) => {
          const index = progress.findIndex((item) => item.key === entry.key);
          if (index < 0) progress.push(entry);
          else progress[index] = entry;
        },
      };
      await expect(saveProductWebpQueue(input)).rejects.toThrow('temporary failure');
      const identities = progress.map(({ imageId, sha256, operationKey, ownerId }) => ({
        imageId,
        sha256,
        operationKey,
        ownerId,
      }));
      await expect(saveProductWebpQueue(input)).resolves.toEqual(expected);
      expect(
        progress.map(({ imageId, sha256, operationKey, ownerId }) => ({
          imageId,
          sha256,
          operationKey,
          ownerId,
        })),
      ).toEqual(identities);
      expect(upload).toHaveBeenCalledTimes(candidates.length);
      expect(register).toHaveBeenCalledTimes(scenario === 'partial batch' ? 3 : 1);
      expect(register.mock.calls.filter(([entry]) => entry.imageId === imageId)).toHaveLength(1);
    },
  );
});
