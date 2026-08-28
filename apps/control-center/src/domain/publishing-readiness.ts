export type PublishingReadinessStatus = 'READY' | 'REVIEW' | 'BLOCKED';

export type PublishingStage =
  | 'SNAPSHOT_DRAFT'
  | 'RENDER_READY'
  | 'ARTIFACT_PUBLISHED'
  | 'STOREFRONT_PREPARED'
  | 'STOREFRONT_EXECUTED'
  | 'STOREFRONT_VERIFIED';

export type PublishingNextAction =
  | 'COMPLETE_SNAPSHOT'
  | 'REGISTER_ARTIFACT'
  | 'PREPARE_STOREFRONT_CUTOVER'
  | 'EXECUTE_STOREFRONT_CUTOVER'
  | 'VERIFY_STOREFRONT_CUTOVER'
  | 'NONE';

export interface PublishingVersionState {
  readonly status: string;
  readonly publicationStatus: string;
  readonly visibleEntries: number;
  readonly artifactUrl: string | null;
  readonly artifactSha256: string | null;
  readonly artifactPageCount: number | null;
  readonly artifactSizeBytes: number | null;
}

export interface PublishingCutoverState {
  readonly status: 'PREPARED' | 'EXECUTED' | 'VERIFIED';
  readonly sourceCount: number;
  readonly eligibleCount: number;
  readonly blockedCount: number;
  readonly affectedCount: number;
}

export interface PublishingReadinessResult {
  readonly status: PublishingReadinessStatus;
  readonly stage: PublishingStage;
  readonly nextAction: PublishingNextAction;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

function hasFrozenArtifact(version: PublishingVersionState): boolean {
  return Boolean(
    version.artifactUrl?.trim() &&
      version.artifactSha256?.trim() &&
      version.artifactPageCount != null &&
      version.artifactPageCount > 0 &&
      version.artifactSizeBytes != null &&
      version.artifactSizeBytes > 0,
  );
}

/**
 * Evalúa el estado de publicación sin ejecutar mutaciones.
 * Product Master no se considera una fuente publicable directa: la cadena esperada es
 * Eligibility -> Snapshot -> Catalog Version -> Artifact -> Storefront cutover.
 */
export function evaluatePublishingReadiness(input: {
  readonly version: PublishingVersionState;
  readonly cutover: PublishingCutoverState | null;
}): PublishingReadinessResult {
  const { version, cutover } = input;
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (version.visibleEntries <= 0) {
    blockers.push('SNAPSHOT_EMPTY');
  }

  if (version.status === 'DRAFT') {
    return {
      status: blockers.length > 0 ? 'BLOCKED' : 'REVIEW',
      stage: 'SNAPSHOT_DRAFT',
      nextAction: 'COMPLETE_SNAPSHOT',
      blockers,
      warnings,
    };
  }

  if (version.status !== 'ACTIVE') {
    blockers.push('CATALOG_VERSION_NOT_ACTIVE');
  }

  if (version.publicationStatus === 'READY_TO_RENDER') {
    return {
      status: blockers.length > 0 ? 'BLOCKED' : 'READY',
      stage: 'RENDER_READY',
      nextAction: 'REGISTER_ARTIFACT',
      blockers,
      warnings,
    };
  }

  if (version.publicationStatus !== 'PUBLISHED') {
    blockers.push('PUBLICATION_STATUS_NOT_READY');
    return {
      status: 'BLOCKED',
      stage: 'RENDER_READY',
      nextAction: 'REGISTER_ARTIFACT',
      blockers,
      warnings,
    };
  }

  if (!hasFrozenArtifact(version)) {
    blockers.push('PUBLISHED_ARTIFACT_INCOMPLETE');
  }

  if (!cutover) {
    return {
      status: blockers.length > 0 ? 'BLOCKED' : 'REVIEW',
      stage: 'ARTIFACT_PUBLISHED',
      nextAction: 'PREPARE_STOREFRONT_CUTOVER',
      blockers,
      warnings,
    };
  }

  if (cutover.sourceCount !== version.visibleEntries) {
    blockers.push('CUTOVER_SOURCE_COUNT_MISMATCH');
  }
  if (cutover.blockedCount > 0) {
    blockers.push('CUTOVER_HAS_BLOCKED_PRODUCTS');
  }
  if (cutover.eligibleCount !== cutover.sourceCount) {
    blockers.push('CUTOVER_ELIGIBILITY_MISMATCH');
  }

  if (cutover.status === 'PREPARED') {
    return {
      status: blockers.length > 0 ? 'BLOCKED' : 'READY',
      stage: 'STOREFRONT_PREPARED',
      nextAction: 'EXECUTE_STOREFRONT_CUTOVER',
      blockers,
      warnings,
    };
  }

  if (cutover.status === 'EXECUTED') {
    if (cutover.affectedCount > cutover.sourceCount) {
      blockers.push('CUTOVER_AFFECTED_COUNT_EXCEEDS_SOURCE');
    }
    return {
      status: blockers.length > 0 ? 'BLOCKED' : 'REVIEW',
      stage: 'STOREFRONT_EXECUTED',
      nextAction: 'VERIFY_STOREFRONT_CUTOVER',
      blockers,
      warnings,
    };
  }

  if (cutover.affectedCount > cutover.sourceCount) {
    blockers.push('CUTOVER_AFFECTED_COUNT_EXCEEDS_SOURCE');
  }

  return {
    status: blockers.length > 0 ? 'BLOCKED' : 'READY',
    stage: 'STOREFRONT_VERIFIED',
    nextAction: 'NONE',
    blockers,
    warnings,
  };
}
