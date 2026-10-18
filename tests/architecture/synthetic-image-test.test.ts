import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  SYNTHETIC_PROJECT_URL,
  SYNTHETIC_PRODUCT_ID,
  SYNTHETIC_SOURCE_SHA256,
  SYNTHETIC_SKU,
} from '../../supabase/functions/intelligence-runtime/synthetic-image-test';
import {
  verifyExternalImageOnServer,
  type ServerImageEvidence,
} from '../../supabase/functions/intelligence-runtime/external-image-verification';
import { ingestAuthorizedExternalImage } from '../../supabase/functions/intelligence-runtime/external-image-ingestion';

function fixture() {
  const png = new Uint8Array(readFileSync('tests/fixtures/synthetic-dev.png'));
  const now = Date.now();
  const expiry = new Date(now + 10 * 60_000).toISOString();
  const binding = {
    productId: SYNTHETIC_PRODUCT_ID,
    sku: SYNTHETIC_SKU,
    reference: 'SYNTHETIC',
    presentation: '600x600',
    tone: 'geometric',
    variant: 'synthetic',
    productVersion: 'version',
    candidateId: 'candidate',
    operationKey: 'operation',
    actorId: 'owner',
    sourceUrl: 'https://controlled.example/synthetic.png',
    sourceSha256: SYNTHETIC_SOURCE_SHA256,
  };
  const e: ServerImageEvidence = {
    mode: 'SYNTHETIC_TEST',
    binding,
    revision: 'synthetic-1',
    sourcePageUrl: 'https://controlled.example/provenance',
    authority: {
      host: 'controlled.example',
      evidenceId: 'synthetic-authority',
      expiresAt: expiry,
      revoked: false,
    },
    rights: {
      documentId: 'synthetic-permission',
      commercialUse: false,
      expiresAt: expiry,
      revoked: false,
    },
    approval: {
      id: 'synthetic-human-approval',
      reviewerId: 'owner',
      binding: { ...binding },
      expiresAt: expiry,
      revoked: false,
    },
    synthetic: {
      provenanceDocumentId: 'synthetic-permission',
      documentSha256: 'd'.repeat(64),
      approvedAt: new Date(now).toISOString(),
      humanTestApproval: true,
    },
    exactIdentityEvidenceId: '',
    authenticPhotographEvidenceId: '',
    contradictions: [],
    role: 'FRONT',
  };
  const webp = new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);
  const ports = {
    projectUrl: SYNTHETIC_PROJECT_URL,
    loadCurrentBinding: vi.fn(async () => structuredClone(e.binding)),
    loadEvidence: vi.fn(async () => structuredClone(e)),
    retrieveSource: vi.fn(async () => png),
    convertToWebp: vi.fn(async () => ({ bytes: webp, width: 600, height: 600 })),
    now: () => now,
  };
  return { e, ports, png, webp };
}
describe('honest isolated synthetic acceptance contract', () => {
  it('pins the actual prepared PNG hash and accepts no commercial-photo claims', async () => {
    const { png, ports } = fixture();
    expect(createHash('sha256').update(png).digest('hex')).toBe(SYNTHETIC_SOURCE_SHA256);
    await expect(
      verifyExternalImageOnServer('candidate', 'operation', ports),
    ).resolves.toMatchObject({ sourceSha256: SYNTHETIC_SOURCE_SHA256 });
  });
  it.each([
    'project',
    'product',
    'hash',
    'sku',
    'commercial',
    'photograph',
    'identity',
    'approval',
    'provenance',
    'document',
    'expired',
    'long',
    'future',
    'revoked',
    'changed-content',
  ])('rejects %s before registration', async (scenario) => {
    const { e, ports } = fixture();
    switch (scenario) {
      case 'project':
        ports.projectUrl = 'https://gqitoossdbiohqegjvlh.supabase.co';
        break;
      case 'product':
        e.binding.productId = 'other';
        e.approval.binding.productId = 'other';
        break;
      case 'hash':
        e.binding.sourceSha256 = 'b'.repeat(64);
        e.approval.binding.sourceSha256 = 'b'.repeat(64);
        break;
      case 'sku':
        e.binding.sku = 'commercial';
        e.approval.binding.sku = 'commercial';
        break;
      case 'commercial':
        e.rights.commercialUse = true;
        break;
      case 'photograph':
        e.authenticPhotographEvidenceId = 'false-photo';
        break;
      case 'identity':
        e.exactIdentityEvidenceId = 'false-identity';
        break;
      case 'approval':
        e.synthetic!.humanTestApproval = false;
        break;
      case 'provenance':
        e.synthetic!.provenanceDocumentId = '';
        break;
      case 'document':
        e.synthetic!.documentSha256 = '';
        break;
      case 'expired':
        e.approval.expiresAt = '2000-01-01';
        break;
      case 'long':
        e.approval.expiresAt = '2099-01-01';
        break;
      case 'future':
        e.synthetic!.approvedAt = '2099-01-01';
        break;
      case 'revoked':
        e.approval.revoked = true;
        break;
      case 'changed-content':
        ports.retrieveSource.mockResolvedValue(new Uint8Array([1]));
        break;
    }
    await expect(verifyExternalImageOnServer('candidate', 'operation', ports)).rejects.toThrow();
  });
  it('rejects commercial conversion of the reserved product', async () => {
    const { e, ports } = fixture();
    e.mode = 'VERIFIED_EXTERNAL';
    e.rights.commercialUse = true;
    e.authenticPhotographEvidenceId = 'claimed';
    e.exactIdentityEvidenceId = 'claimed';
    await expect(verifyExternalImageOnServer('candidate', 'operation', ports)).rejects.toThrow(
      'SYNTHETIC_COMMERCIAL_FORBIDDEN',
    );
  });
  it('rejects approval or resource mutation during download', async () => {
    const { e, ports, png } = fixture();
    ports.retrieveSource.mockImplementation(async () => {
      e.synthetic!.humanTestApproval = false;
      return png;
    });
    await expect(verifyExternalImageOnServer('candidate', 'operation', ports)).rejects.toThrow();
  });
  it('uses the existing upload/readback chain with private Storage and synthetic RPCs only', async () => {
    const { e, ports, webp } = fixture();
    const bucket = {
      upload: vi.fn(async () => ({ error: null })),
      download: vi.fn(async () => ({ data: new Blob([webp]), error: null })),
    };
    const client = {
      rpc: vi.fn(async (name: string) => ({
        error: null,
        data:
          name === 'read_synthetic_image_authorization'
            ? { evidence: structuredClone(e), imageId: 'stable', result: null }
            : { sourceType: 'SYNTHETIC_TEST', commercialEligible: false },
      })),
      storage: { from: vi.fn(() => bucket) },
    };
    await expect(
      ingestAuthorizedExternalImage({
        projectUrl: SYNTHETIC_PROJECT_URL,
        actorId: 'owner',
        candidateId: 'candidate',
        operationKey: 'operation',
        mode: 'SYNTHETIC_TEST',
        client,
        convert: ports.convertToWebp,
        retrieve: ports.retrieveSource,
      }),
    ).resolves.toMatchObject({ sourceType: 'SYNTHETIC_TEST', commercialEligible: false });
    expect(client.storage.from).toHaveBeenCalledWith('lihen-product-originals');
    expect(bucket.upload).toHaveBeenCalledWith(
      expect.stringContaining('_synthetic_tests/' + SYNTHETIC_PRODUCT_ID + '/stable/web/'),
      expect.any(Uint8Array),
      { contentType: 'image/webp', upsert: false },
    );
    expect(
      client.rpc.mock.calls.every(
        ([name]) =>
          name === 'read_synthetic_image_authorization' ||
          name === 'finalize_synthetic_product_webp',
      ),
    ).toBe(true);
  });
});
