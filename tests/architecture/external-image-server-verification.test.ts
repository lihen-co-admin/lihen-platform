import { describe, expect, it, vi } from 'vitest';
import {
  verifyExternalImageOnServer,
  type ServerImageEvidence,
  type ServerImageVerificationPorts,
} from '../../supabase/functions/intelligence-runtime/external-image-verification';

const now = Date.parse('2026-10-17T12:00:00Z');
const expiry = '2026-10-18T12:00:00Z';
async function fixture() {
  const source = new Uint8Array([1, 2, 3]);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', source)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  const binding = {
    productId: 'product',
    sku: 'sku',
    reference: 'reference',
    presentation: '10 ml',
    tone: '01',
    variant: 'variant',
    productVersion: 'v1',
    candidateId: 'candidate',
    operationKey: 'operation',
    actorId: 'actor',
    sourceUrl: 'https://official.example/image.png',
    sourceSha256: hash,
  };
  const evidence: ServerImageEvidence = {
    binding,
    revision: '1',
    sourcePageUrl: 'https://official.example/product',
    authority: {
      evidenceId: 'authority',
      host: 'official.example',
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
    authenticPhotographEvidenceId: 'authentic',
    contradictions: [],
    role: 'FRONT',
  };
  // Synthetic RIFF envelope only; trusted decoder adapter is deliberately mocked, not certified.
  const webp = new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);
  const ports: ServerImageVerificationPorts = {
    loadCurrentBinding: vi.fn(async () => structuredClone(binding)),
    loadEvidence: vi.fn(async () => structuredClone(evidence)),
    retrieveSource: vi.fn(async () => source),
    convertToWebp: vi.fn(async () => ({ bytes: webp, width: 800, height: 800 })),
    now: () => now,
  };
  return { binding, evidence, ports };
}
describe('server external-image preflight remains non-authorizing', () => {
  it('blocks without trusted server adapters', async () => {
    await expect(verifyExternalImageOnServer('candidate', 'operation')).rejects.toThrow(
      'TRUSTED_SERVER_ADAPTERS_REQUIRED',
    );
  });
  it('binds source and derivative but never issues save permission', async () => {
    const { ports } = await fixture();
    expect(await verifyExternalImageOnServer('candidate', 'operation', ports)).toMatchObject({
      status: 'VERIFIED_NOT_AUTHORIZED_FOR_SAVE',
      role: 'FRONT',
    });
  });
  it.each([
    'productId',
    'sku',
    'reference',
    'presentation',
    'tone',
    'variant',
    'productVersion',
    'candidateId',
    'operationKey',
    'actorId',
    'sourceUrl',
    'sourceSha256',
  ] as const)('rejects changed %s approval binding before download', async (key) => {
    const { ports, evidence } = await fixture();
    evidence.approval.binding[key] = 'substituted';
    await expect(verifyExternalImageOnServer('candidate', 'operation', ports)).rejects.toThrow(
      'BINDING_MISMATCH',
    );
    expect(ports.retrieveSource).not.toHaveBeenCalled();
  });
  it.each(['authority', 'rights', 'approval'] as const)(
    'rejects expired or revoked %s',
    async (key) => {
      const { ports, evidence } = await fixture();
      evidence[key].expiresAt = 'invalid';
      await expect(verifyExternalImageOnServer('candidate', 'operation', ports)).rejects.toThrow();
      evidence[key].expiresAt = expiry;
      evidence[key].revoked = true;
      await expect(verifyExternalImageOnServer('candidate', 'operation', ports)).rejects.toThrow();
      expect(ports.retrieveSource).not.toHaveBeenCalled();
    },
  );
  it('rejects missing rights, contradictions and missing authentic evidence', async () => {
    const { ports, evidence } = await fixture();
    evidence.rights.commercialUse = false;
    await expect(verifyExternalImageOnServer('candidate', 'operation', ports)).rejects.toThrow(
      'RIGHTS_INVALID',
    );
    evidence.rights.commercialUse = true;
    evidence.contradictions = ['wrong tone'];
    await expect(verifyExternalImageOnServer('candidate', 'operation', ports)).rejects.toThrow(
      'IDENTITY_UNVERIFIED',
    );
    evidence.contradictions = [];
    evidence.authenticPhotographEvidenceId = '';
    await expect(verifyExternalImageOnServer('candidate', 'operation', ports)).rejects.toThrow(
      'IDENTITY_UNVERIFIED',
    );
  });
  it('rejects substituted content before conversion', async () => {
    const { ports } = await fixture();
    ports.retrieveSource = vi.fn(async () => new Uint8Array([9]));
    await expect(verifyExternalImageOnServer('candidate', 'operation', ports)).rejects.toThrow(
      'CONTENT_CHANGED',
    );
    expect(ports.convertToWebp).not.toHaveBeenCalled();
  });
  it('rejects evidence changed or revoked during conversion, including retries', async () => {
    const { ports, evidence } = await fixture();
    const original = ports.convertToWebp;
    ports.convertToWebp = async (bytes) => {
      evidence.rights.revoked = true;
      return original(bytes);
    };
    await expect(verifyExternalImageOnServer('candidate', 'operation', ports)).rejects.toThrow(
      'RIGHTS_INVALID',
    );
    await expect(verifyExternalImageOnServer('candidate', 'operation', ports)).rejects.toThrow(
      'RIGHTS_INVALID',
    );
    expect(ports.retrieveSource).toHaveBeenCalledTimes(1);
  });
  it('rejects low quality conversion', async () => {
    const { ports } = await fixture();
    ports.convertToWebp = async () => ({ bytes: new Uint8Array([1]), width: 1, height: 1 });
    await expect(verifyExternalImageOnServer('candidate', 'operation', ports)).rejects.toThrow(
      'QUALITY_INVALID',
    );
  });
  it('rejects non-official source URLs before retrieval', async () => {
    const { ports, evidence, binding } = await fixture();
    binding.sourceUrl = 'https://127.0.0.1/a';
    evidence.approval.binding.sourceUrl = binding.sourceUrl;
    await expect(verifyExternalImageOnServer('candidate', 'operation', ports)).rejects.toThrow(
      'SOURCE_INVALID',
    );
    expect(ports.retrieveSource).not.toHaveBeenCalled();
  });
});
