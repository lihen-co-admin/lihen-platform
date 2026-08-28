export type PublishingArtifactIntegrityStatus = 'PASS' | 'REVIEW' | 'BLOCKED';

export interface PublishingArtifactState {
  readonly catalogStatus: string;
  readonly publicationStatus: string;
  readonly totalEntries: number;
  readonly visibleEntries: number;
  readonly activatedAt: string | null;
  readonly artifactUrl: string | null;
  readonly artifactSha256: string | null;
  readonly artifactPageCount: number | null;
  readonly artifactSizeBytes: number | null;
  readonly rendererVersion: string | null;
}

export interface PublishingArtifactIntegrityResult {
  readonly status: PublishingArtifactIntegrityStatus;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

const SHA256_HEX = /^[a-f0-9]{64}$/i;
const MAX_PDF_BYTES = 100 * 1024 * 1024;

function hasSafeArtifactUrl(value: string | null): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Verifica que una versión PUBLISHED conserve un artefacto PDF congelado y explicable.
 * No descarga, reescribe ni repara el artefacto; únicamente interpreta sus metadatos.
 */
export function evaluatePublishingArtifactIntegrity(
  artifact: PublishingArtifactState,
  expectedRendererVersion?: string,
): PublishingArtifactIntegrityResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (artifact.catalogStatus !== 'ACTIVE') {
    blockers.push('CATALOG_VERSION_NOT_ACTIVE');
  }

  if (artifact.visibleEntries <= 0) {
    blockers.push('CATALOG_SNAPSHOT_EMPTY');
  }

  if (artifact.totalEntries < artifact.visibleEntries) {
    blockers.push('VISIBLE_ENTRIES_EXCEED_TOTAL_ENTRIES');
  }

  if (artifact.publicationStatus !== 'PUBLISHED') {
    warnings.push('ARTIFACT_NOT_PUBLISHED_YET');
    return {
      status: blockers.length > 0 ? 'BLOCKED' : 'REVIEW',
      blockers,
      warnings,
    };
  }

  if (!hasSafeArtifactUrl(artifact.artifactUrl)) {
    blockers.push('ARTIFACT_URL_INVALID');
  }

  if (!artifact.artifactSha256?.trim() || !SHA256_HEX.test(artifact.artifactSha256.trim())) {
    blockers.push('ARTIFACT_SHA256_INVALID');
  }

  if (
    artifact.artifactPageCount == null ||
    !Number.isInteger(artifact.artifactPageCount) ||
    artifact.artifactPageCount <= 0
  ) {
    blockers.push('ARTIFACT_PAGE_COUNT_INVALID');
  }

  if (
    artifact.artifactSizeBytes == null ||
    !Number.isInteger(artifact.artifactSizeBytes) ||
    artifact.artifactSizeBytes <= 0 ||
    artifact.artifactSizeBytes > MAX_PDF_BYTES
  ) {
    blockers.push('ARTIFACT_SIZE_INVALID');
  }

  if (!artifact.activatedAt) {
    warnings.push('CATALOG_ACTIVATION_TIMESTAMP_MISSING');
  }

  if (!artifact.rendererVersion?.trim()) {
    warnings.push('RENDERER_VERSION_MISSING');
  } else if (
    expectedRendererVersion &&
    artifact.rendererVersion.trim() !== expectedRendererVersion.trim()
  ) {
    warnings.push('RENDERER_VERSION_DIFFERS_FROM_EXPECTED');
  }

  return {
    status: blockers.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'REVIEW' : 'PASS',
    blockers,
    warnings,
  };
}
