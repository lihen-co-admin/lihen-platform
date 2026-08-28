import { describe, expect, it } from 'vitest';
import { evaluatePublishingArtifactIntegrity } from '../src/domain/publishing-artifact-integrity';

const valid = {
  catalogStatus: 'ACTIVE',
  publicationStatus: 'PUBLISHED',
  totalEntries: 952,
  visibleEntries: 952,
  activatedAt: '2026-08-27T12:00:00.000Z',
  artifactUrl: 'https://example.supabase.co/storage/v1/object/public/catalog/catalog.pdf',
  artifactSha256: 'a'.repeat(64),
  artifactPageCount: 220,
  artifactSizeBytes: 12_000_000,
  rendererVersion: 'catalog-renderer-v2-institutional',
} as const;

describe('evaluatePublishingArtifactIntegrity', () => {
  it('reports PASS for a frozen active published artifact', () => {
    expect(
      evaluatePublishingArtifactIntegrity(valid, 'catalog-renderer-v2-institutional'),
    ).toEqual({ status: 'PASS', blockers: [], warnings: [] });
  });

  it('blocks malformed SHA-256 metadata', () => {
    const result = evaluatePublishingArtifactIntegrity({ ...valid, artifactSha256: 'abc' });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('ARTIFACT_SHA256_INVALID');
  });

  it('blocks invalid artifact URLs', () => {
    const result = evaluatePublishingArtifactIntegrity({ ...valid, artifactUrl: 'blob:local' });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('ARTIFACT_URL_INVALID');
  });

  it('blocks impossible snapshot counts', () => {
    const result = evaluatePublishingArtifactIntegrity({ ...valid, totalEntries: 900 });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('VISIBLE_ENTRIES_EXCEED_TOTAL_ENTRIES');
  });

  it('reviews a version whose PDF has not been published yet', () => {
    const result = evaluatePublishingArtifactIntegrity({
      ...valid,
      publicationStatus: 'READY_TO_RENDER',
      artifactUrl: null,
      artifactSha256: null,
      artifactPageCount: null,
      artifactSizeBytes: null,
    });
    expect(result.status).toBe('REVIEW');
    expect(result.warnings).toContain('ARTIFACT_NOT_PUBLISHED_YET');
  });

  it('reviews missing provenance without pretending the artifact is corrupt', () => {
    const result = evaluatePublishingArtifactIntegrity({
      ...valid,
      activatedAt: null,
      rendererVersion: null,
    });
    expect(result.status).toBe('REVIEW');
    expect(result.warnings).toEqual([
      'CATALOG_ACTIVATION_TIMESTAMP_MISSING',
      'RENDERER_VERSION_MISSING',
    ]);
  });
});
