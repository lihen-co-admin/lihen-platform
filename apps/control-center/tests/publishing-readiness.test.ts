import { describe, expect, it } from 'vitest';
import { evaluatePublishingReadiness } from '../src/domain/publishing-readiness';

const publishedVersion = {
  status: 'ACTIVE',
  publicationStatus: 'PUBLISHED',
  visibleEntries: 10,
  artifactUrl: 'https://example.test/catalog.pdf',
  artifactSha256: 'abc123',
  artifactPageCount: 12,
  artifactSizeBytes: 1024,
} as const;

describe('evaluatePublishingReadiness', () => {
  it('blocks an empty draft snapshot', () => {
    const result = evaluatePublishingReadiness({
      version: { ...publishedVersion, status: 'DRAFT', publicationStatus: 'DRAFT', visibleEntries: 0 },
      cutover: null,
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('SNAPSHOT_EMPTY');
  });

  it('marks an active render-ready version as ready to register its artifact', () => {
    const result = evaluatePublishingReadiness({
      version: { ...publishedVersion, publicationStatus: 'READY_TO_RENDER', artifactUrl: null, artifactSha256: null, artifactPageCount: null, artifactSizeBytes: null },
      cutover: null,
    });
    expect(result.status).toBe('READY');
    expect(result.nextAction).toBe('REGISTER_ARTIFACT');
  });

  it('requires storefront preparation after a valid frozen artifact is published', () => {
    const result = evaluatePublishingReadiness({ version: publishedVersion, cutover: null });
    expect(result.status).toBe('REVIEW');
    expect(result.stage).toBe('ARTIFACT_PUBLISHED');
    expect(result.nextAction).toBe('PREPARE_STOREFRONT_CUTOVER');
  });

  it('blocks a prepared cutover when source and eligibility counts diverge', () => {
    const result = evaluatePublishingReadiness({
      version: publishedVersion,
      cutover: { status: 'PREPARED', sourceCount: 10, eligibleCount: 9, blockedCount: 1, affectedCount: 0 },
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('CUTOVER_HAS_BLOCKED_PRODUCTS');
    expect(result.blockers).toContain('CUTOVER_ELIGIBILITY_MISMATCH');
  });

  it('allows execution only after a fully reconciled prepared cutover', () => {
    const result = evaluatePublishingReadiness({
      version: publishedVersion,
      cutover: { status: 'PREPARED', sourceCount: 10, eligibleCount: 10, blockedCount: 0, affectedCount: 0 },
    });
    expect(result.status).toBe('READY');
    expect(result.nextAction).toBe('EXECUTE_STOREFRONT_CUTOVER');
  });

  it('closes publishing readiness only after a verified cutover', () => {
    const result = evaluatePublishingReadiness({
      version: publishedVersion,
      cutover: { status: 'VERIFIED', sourceCount: 10, eligibleCount: 10, blockedCount: 0, affectedCount: 10 },
    });
    expect(result.status).toBe('READY');
    expect(result.stage).toBe('STOREFRONT_VERIFIED');
    expect(result.nextAction).toBe('NONE');
  });
});
