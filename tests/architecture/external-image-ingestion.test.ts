import { describe, expect, it, vi } from 'vitest';
import {
  ingestAuthorizedExternalImage,
  type ExternalImageBackend,
} from '../../supabase/functions/intelligence-runtime/external-image-ingestion';
import type { ServerImageEvidence } from '../../supabase/functions/intelligence-runtime/external-image-verification';

async function fixture() {
  const png = new Uint8Array(45);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const dv = new DataView(png.buffer);
  dv.setUint32(8, 13);
  png.set([73, 72, 68, 82], 12);
  dv.setUint32(16, 600);
  dv.setUint32(20, 600);
  png.set([73, 69, 78, 68], 37);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', png)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  const binding = {
    productId: 'p',
    sku: 'sku',
    reference: 'reference',
    presentation: '10 ml',
    tone: '01',
    variant: '01',
    productVersion: 'v1',
    candidateId: 'candidate',
    operationKey: 'operation',
    actorId: 'actor',
    sourceUrl: 'https://official.example/a',
    sourceSha256: hash,
  };
  const expiry = '2099-01-01T00:00:00Z';
  const evidence: ServerImageEvidence = {
    binding,
    revision: 'r1',
    sourcePageUrl: 'https://official.example/p',
    authority: {
      host: 'official.example',
      evidenceId: 'official',
      expiresAt: expiry,
      revoked: false,
    },
    rights: { documentId: 'license', commercialUse: true, expiresAt: expiry, revoked: false },
    approval: {
      id: 'approval',
      reviewerId: 'reviewer',
      binding: { ...binding },
      expiresAt: expiry,
      revoked: false,
    },
    exactIdentityEvidenceId: 'identity',
    authenticPhotographEvidenceId: 'photo',
    contradictions: [],
    role: 'FRONT',
  };
  const webp = new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);
  const bucket = {
    upload: vi.fn(async () => ({ error: null as unknown })),
    download: vi.fn(async () => ({ data: new Blob([webp]), error: null as unknown })),
  };
  const ctx = { evidence, imageId: 'stable-image', result: null as Record<string, unknown> | null };
  const client = {
    rpc: vi.fn(async (name: string) => ({
      data:
        name === 'read_external_image_authorization'
          ? structuredClone(ctx)
          : { imageId: 'stable-image', sourceType: 'VERIFIED_EXTERNAL' },
      error: null,
    })),
    storage: { from: vi.fn(() => bucket) },
  } satisfies ExternalImageBackend;
  const input = {
    projectUrl: 'https://vnmkupzptujtywnnabkp.supabase.co',
    actorId: 'actor',
    candidateId: 'candidate',
    operationKey: 'operation',
    client,
    convert: vi.fn(async () => ({ bytes: webp, width: 600, height: 600 })),
    retrieve: vi.fn(async () => png),
  };
  return { input, ctx, bucket };
}
describe('external ingestion server chain with synthetic adapters', () => {
  it('uses bound immutable storage path, verifies readback, then calls transactional finalizer', async () => {
    const { input, bucket } = await fixture();
    expect(await ingestAuthorizedExternalImage(input)).toMatchObject({
      sourceType: 'VERIFIED_EXTERNAL',
    });
    expect(bucket.upload).toHaveBeenCalledWith(
      expect.stringContaining('products/p/stable-image/web/'),
      expect.any(Uint8Array),
      { contentType: 'image/webp', upsert: false },
    );
    expect(input.client.rpc.mock.calls.at(-1)?.[0]).toBe('finalize_external_product_webp');
  });
  it('blocks PROD before any side effect', async () => {
    const { input } = await fixture();
    input.projectUrl = 'https://prod.invalid';
    await expect(ingestAuthorizedExternalImage(input)).rejects.toThrow('DEV_ACTOR');
    expect(input.client.rpc).not.toHaveBeenCalled();
  });
  it('blocks mismatched actor before download', async () => {
    const { input } = await fixture();
    input.actorId = 'other';
    await expect(ingestAuthorizedExternalImage(input)).rejects.toThrow('CONTEXT');
    expect(input.retrieve).not.toHaveBeenCalled();
  });
  it('does not register corrupted stored bytes', async () => {
    const { input, bucket } = await fixture();
    bucket.download.mockResolvedValue({ data: new Blob(['bad']), error: null });
    await expect(ingestAuthorizedExternalImage(input)).rejects.toThrow('STORAGE_HASH');
    expect(
      input.client.rpc.mock.calls.every((c) => c[0] !== 'finalize_external_product_webp'),
    ).toBe(true);
  });
  it('reconciles uncertain upload with same identity and never upserts or deletes', async () => {
    const { input, bucket } = await fixture();
    bucket.upload.mockResolvedValue({ error: 'timeout' });
    await expect(ingestAuthorizedExternalImage(input)).resolves.toBeDefined();
    expect(bucket.upload).toHaveBeenCalledTimes(1);
  });
  it('reconciles committed uncertain operations without source retrieval or conversion', async () => {
    const { input, ctx, bucket } = await fixture();
    ctx.result = {
      fingerprint: { sha256: 'saved', bytes: 12, width: 600, height: 600, revision: 'r1' },
    };
    await ingestAuthorizedExternalImage(input);
    expect(input.retrieve).not.toHaveBeenCalled();
    expect(input.convert).not.toHaveBeenCalled();
    expect(bucket.upload).not.toHaveBeenCalled();
  });
});
