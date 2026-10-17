import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  EXTERNAL_PRODUCT_IMAGE_SAVE_BLOCKED,
  type ExternalProductImageSelection,
} from '../src/composition/external-product-image-save';
import {
  saveProductWebpQueue,
  type ProductWebpCandidate,
  type ProductWebpProgress,
} from '../src/composition/product-webp-save';

const productId = 'product-fixture';
const ownerId = 'owner-fixture';
const file = new File(['synthetic-webp'], 'manual.webp', { type: 'image/webp' });
const sha256 = createHash('sha256').update('synthetic-webp').digest('hex');
const manual: ProductWebpCandidate = { key: sha256, file };
function selection(): ExternalProductImageSelection {
  const identity = {
    productId,
    productName: 'Fixture reference',
    brandId: 'brand-fixture',
    brand: 'Fixture',
    knownAttributes: {
      manufacturer: 'Fixture manufacturer',
      officialReference: 'REF-01',
      tone: '01',
      color: 'Purple',
      size: 'Small',
      content: '10 ml',
      presentation: 'Bottle',
      packaging: 'Box',
      gtin: '1234567890128',
    },
  };
  const identityFingerprint = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  return {
    kind: 'EXTERNAL_VERIFIED',
    productId,
    identity,
    identityFingerprint,
    candidateId: 'candidate-fixture',
    resource: { url: 'https://brand.example/photo.webp', sourceSha256: sha256, webpSha256: sha256 },
    operationKey: 'operation-fixture',
    ownerId,
    reviewSessionId: 'review-fixture',
    assessment: {
      imageUrl: 'https://brand.example/photo.webp',
      sourceUrl: 'https://brand.example/product',
      sourceDomain: 'brand.example',
      checkedAt: '2026-10-17T00:00:00Z',
      identity,
      identityMatch: 'EXACT_MATCH',
      authority: 'OFFICIAL_BRAND',
      authorityEvidenceRef: 'fixture-authority',
      authorityExpiresAt: '2027-01-01T00:00:00Z',
      rightsStatus: 'RIGHTS_VERIFIED',
      rightsExpiresAt: '2027-01-01T00:00:00Z',
      evidence: [
        { id: 'fixture-evidence', text: 'Synthetic test fixture, no real licensing claim' },
      ],
      stage: 'RIGHTS_VERIFIED',
      reasons: ['TEST_ONLY'],
      widthPx: 1600,
      heightPx: 1600,
    },
    humanApproval: {
      approvalId: 'approval-fixture',
      actorId: ownerId,
      productId,
      identityFingerprint,
      candidateId: 'candidate-fixture',
      sourceSha256: sha256,
      operationKey: 'operation-fixture',
      approvedAt: '2026-10-17T00:00:00Z',
      expiresAt: '2026-10-18T00:00:00Z',
    },
  };
}
function input(
  candidates: readonly ProductWebpCandidate[],
  progress: readonly ProductWebpProgress[] = [],
) {
  const image = {
    id: 'image-fixture',
    productId,
    publicUrl: 'https://example.invalid/manual.webp',
    isMain: true,
    sortOrder: 0,
    sourceType: 'STORAGE' as const,
  };
  return {
    productId,
    ownerId,
    candidates,
    progress,
    registeredCount: 0,
    upload: vi.fn(async () => ({
      imageId: image.id,
      sha256,
      operationKey: 'operation-manual',
      ownerId,
    })),
    register: vi.fn(async () => {}),
    onProgress: vi.fn(),
    readBack: vi.fn(async () => [image]),
  };
}

describe('external save is disabled, not authorized by browser evidence', () => {
  // Total refusal is tested here, NOT a frontend substitute for server verification.
  const scenarios: readonly [string, (value: ExternalProductImageSelection) => unknown][] = [
    ['apparently complete browser evidence', (value) => value],
    [
      'URL without evidence or approval',
      () => ({ resource: { url: 'https://brand.example/photo.webp' } }),
    ],
    [
      'substituted resource URL',
      (value) => ({
        ...value,
        resource: { ...value.resource, url: 'https://brand.example/other.webp' },
      }),
    ],
    [
      'substituted source content',
      (value) => ({ ...value, resource: { ...value.resource, sourceSha256: '0'.repeat(64) } }),
    ],
    [
      'substituted WebP derivative',
      (value) => ({ ...value, resource: { ...value.resource, webpSha256: '0'.repeat(64) } }),
    ],
    ['different product', (value) => ({ ...value, productId: 'other-product' })],
    [
      'different variant',
      (value) => ({
        ...value,
        identity: {
          ...value.identity,
          knownAttributes: { ...value.identity.knownAttributes, tone: '02' },
        },
      }),
    ],
    [
      'expired authority',
      (value) => ({
        ...value,
        assessment: { ...value.assessment, authorityExpiresAt: '2020-01-01T00:00:00Z' },
      }),
    ],
    [
      'expired rights',
      (value) => ({
        ...value,
        assessment: { ...value.assessment, rightsExpiresAt: '2020-01-01T00:00:00Z' },
      }),
    ],
    [
      'unknown rights',
      (value) => ({ ...value, assessment: { ...value.assessment, rightsStatus: 'UNKNOWN' } }),
    ],
    ['missing human approval', (value) => ({ ...value, humanApproval: undefined })],
    [
      'expired human approval',
      (value) => ({
        ...value,
        humanApproval: { ...value.humanApproval, expiresAt: '2020-01-01T00:00:00Z' },
      }),
    ],
    [
      'approval for another resource',
      (value) => ({
        ...value,
        humanApproval: { ...value.humanApproval, candidateId: 'other-candidate' },
      }),
    ],
    [
      'reused authorization after operation change',
      (value) => ({ ...value, operationKey: 'another-operation' }),
    ],
    ['reused authorization after reload', (value) => JSON.parse(JSON.stringify(value))],
  ];
  it.each(scenarios)('rejects %s before any side effect', async (_label, transform) => {
    const external = {
      ...manual,
      origin: 'EXTERNAL_VERIFIED',
      externalSelection: transform(selection()),
    } as ProductWebpCandidate;
    const request = input([external]);
    await expect(saveProductWebpQueue(request)).rejects.toThrow(
      EXTERNAL_PRODUCT_IMAGE_SAVE_BLOCKED,
    );
    expect(request.upload).not.toHaveBeenCalled();
    expect(request.register).not.toHaveBeenCalled();
    expect(request.onProgress).not.toHaveBeenCalled();
    expect(request.readBack).not.toHaveBeenCalled();
  });
  it('preflights mixed batches before uploading even the first valid manual file', async () => {
    const request = input([
      manual,
      { ...manual, origin: 'EXTERNAL_VERIFIED', externalSelection: selection() },
    ]);
    await expect(saveProductWebpQueue(request)).rejects.toThrow(
      EXTERNAL_PRODUCT_IMAGE_SAVE_BLOCKED,
    );
    expect(request.upload).not.toHaveBeenCalled();
    expect(request.register).not.toHaveBeenCalled();
  });
  it.each(['missing origin', 'false manual origin', 'lost evidence', 'undefined evidence'])(
    'rejects queue manipulation: %s',
    async (scenario) => {
      const evidence = { ...manual, externalSelection: selection() };
      const candidate =
        scenario === 'missing origin'
          ? evidence
          : scenario === 'false manual origin'
            ? { ...evidence, origin: 'MANUAL' as const }
            : scenario === 'lost evidence'
              ? { ...manual, origin: 'EXTERNAL_VERIFIED' as const }
              : { ...manual, externalSelection: undefined };
      const request = input([candidate as ProductWebpCandidate]);
      await expect(saveProductWebpQueue(request)).rejects.toThrow(
        EXTERNAL_PRODUCT_IMAGE_SAVE_BLOCKED,
      );
      expect(request.upload).not.toHaveBeenCalled();
      expect(request.register).not.toHaveBeenCalled();
    },
  );
  it.each(['UPLOADED', 'REGISTERED'] as const)(
    'rejects external %s retry journals with missing candidate evidence',
    async (status) => {
      const pending: ProductWebpProgress = {
        key: sha256,
        sha256,
        productId,
        ownerId,
        imageId: 'image-fixture',
        operationKey: 'operation-fixture',
        altText: 'fixture',
        makeMain: true,
        status,
        origin: 'EXTERNAL_VERIFIED',
      };
      const request = input([manual], [pending]);
      for (let attempt = 0; attempt < 2; attempt++) {
        await expect(saveProductWebpQueue(request)).rejects.toThrow(
          EXTERNAL_PRODUCT_IMAGE_SAVE_BLOCKED,
        );
      }
      expect(request.upload).not.toHaveBeenCalled();
      expect(request.register).not.toHaveBeenCalled();
      expect(request.onProgress).not.toHaveBeenCalled();
      expect(request.readBack).not.toHaveBeenCalled();
    },
  );
  it('preserves manual upload and retry operation identity', async () => {
    const request = input([manual]);
    const progress: ProductWebpProgress[] = [];
    request.register.mockRejectedValueOnce(new Error('uncertain manual registration'));
    const onProgress = (entry: ProductWebpProgress) => {
      progress.splice(0, progress.length, entry);
    };
    await expect(saveProductWebpQueue({ ...request, progress, onProgress })).rejects.toThrow(
      'uncertain manual registration',
    );
    const identity = { ...progress[0] };
    await expect(saveProductWebpQueue({ ...request, progress, onProgress })).resolves.toHaveLength(
      1,
    );
    expect(request.upload).toHaveBeenCalledTimes(1);
    expect(request.register).toHaveBeenCalledTimes(2);
    expect(progress[0]).toMatchObject({ ...identity, status: 'REGISTERED' });
    expect(request.register.mock.calls[0]).toEqual(request.register.mock.calls[1]);
  });
});
