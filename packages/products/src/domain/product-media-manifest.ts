import type {
  ProductMediaSourceSelection,
  ProductMediaSourceSelectionStatus,
} from './product-media-source-selection';
import type {
  ProductMediaReadiness,
  ProductMediaSurface,
} from './product-media-readiness';

export type ProductMediaManifestStatus =
  | 'READY'
  | 'FALLBACK'
  | 'BLOCKED_UNKNOWN_DIMENSIONS'
  | 'BLOCKED_NO_USABLE_SOURCE';

export interface ProductMediaManifestEntry {
  readonly surface: ProductMediaSurface;
  readonly status: ProductMediaManifestStatus;
  readonly selectionStatus: ProductMediaSourceSelectionStatus;
  readonly sourceId?: string;
  readonly readiness?: ProductMediaReadiness;
  readonly noUpscale: true;
}

export interface ProductMediaManifest {
  readonly productId: string;
  readonly dryRun: true;
  readonly entries: readonly ProductMediaManifestEntry[];
}

function toManifestEntry(
  selection: ProductMediaSourceSelection,
): ProductMediaManifestEntry {
  switch (selection.status) {
    case 'SELECTED_READY':
      return {
        surface: selection.surface,
        status: 'READY',
        selectionStatus: selection.status,
        ...(selection.source ? { sourceId: selection.source.sourceId } : {}),
        ...(selection.readiness ? { readiness: selection.readiness } : {}),
        noUpscale: true,
      };

    case 'SELECTED_FALLBACK':
      return {
        surface: selection.surface,
        status: 'FALLBACK',
        selectionStatus: selection.status,
        ...(selection.source ? { sourceId: selection.source.sourceId } : {}),
        ...(selection.readiness ? { readiness: selection.readiness } : {}),
        noUpscale: true,
      };

    case 'UNKNOWN_DIMENSIONS_ONLY':
      return {
        surface: selection.surface,
        status: 'BLOCKED_UNKNOWN_DIMENSIONS',
        selectionStatus: selection.status,
        noUpscale: true,
      };

    case 'NO_USABLE_SOURCE':
      return {
        surface: selection.surface,
        status: 'BLOCKED_NO_USABLE_SOURCE',
        selectionStatus: selection.status,
        noUpscale: true,
      };
  }
}

export function buildProductMediaManifest(
  productId: string,
  selections: readonly ProductMediaSourceSelection[],
): ProductMediaManifest {
  if (!productId.trim()) {
    throw new Error('Product media manifest productId is required.');
  }

  return {
    productId: productId.trim(),
    dryRun: true,
    entries: selections.map(toManifestEntry),
  };
}
