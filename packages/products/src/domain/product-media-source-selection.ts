import type { ProductImageSourceType } from './product-image';
import {
  evaluateProductMediaSourceReadiness,
  type ProductMediaReadiness,
  type ProductMediaSourceCandidate,
  type ProductMediaSurface,
} from './product-media-readiness';

export interface ProductMediaSelectableSource extends ProductMediaSourceCandidate {
  readonly sourceId: string;
}

export type ProductMediaSourceSelectionStatus =
  | 'SELECTED_READY'
  | 'SELECTED_FALLBACK'
  | 'UNKNOWN_DIMENSIONS_ONLY'
  | 'NO_USABLE_SOURCE';

export interface ProductMediaSourceSelection {
  readonly surface: ProductMediaSurface;
  readonly status: ProductMediaSourceSelectionStatus;
  readonly source?: ProductMediaSelectableSource;
  readonly readiness?: ProductMediaReadiness;
}

const SOURCE_PRIORITY: Readonly<Record<ProductImageSourceType, number>> = {
  HUMAN_PROVIDED: 0,
  ORIGINAL: 1,
  OFFICIAL_WEB: 2,
  VERIFIED_EXTERNAL: 3,
  SUPPLIER_PDF: 4,
  SUPPLIER_DRIVE: 5,
  CATALOG_EVIDENCE_CROP: 6,
  STORAGE: 7,
  MANUAL: 8,
  LEGACY_MAIN_IMAGE_URL: 9,
};

function readinessPriority(readiness: ProductMediaReadiness): number {
  switch (readiness) {
    case 'READY':
      return 0;
    case 'FALLBACK':
      return 1;
    case 'UNKNOWN_DIMENSIONS':
      return 2;
    case 'REPLACE':
      return 3;
  }
}

export function selectProductMediaSource(
  surface: ProductMediaSurface,
  candidates: readonly ProductMediaSelectableSource[],
): ProductMediaSourceSelection {
  const evaluated = candidates
    .map((source) => ({
      source,
      readiness: evaluateProductMediaSourceReadiness(source),
    }))
    .sort((left, right) => {
      const readinessDifference =
        readinessPriority(left.readiness) - readinessPriority(right.readiness);

      if (readinessDifference !== 0) return readinessDifference;

      return (
        SOURCE_PRIORITY[left.source.sourceType] -
        SOURCE_PRIORITY[right.source.sourceType]
      );
    });

  const ready = evaluated.find((candidate) => candidate.readiness === 'READY');

  if (ready) {
    return {
      surface,
      status: 'SELECTED_READY',
      source: ready.source,
      readiness: ready.readiness,
    };
  }

  const fallback = evaluated.find(
    (candidate) => candidate.readiness === 'FALLBACK',
  );

  if (fallback) {
    return {
      surface,
      status: 'SELECTED_FALLBACK',
      source: fallback.source,
      readiness: fallback.readiness,
    };
  }

  if (
    evaluated.some(
      (candidate) => candidate.readiness === 'UNKNOWN_DIMENSIONS',
    )
  ) {
    return {
      surface,
      status: 'UNKNOWN_DIMENSIONS_ONLY',
    };
  }

  return {
    surface,
    status: 'NO_USABLE_SOURCE',
  };
}
