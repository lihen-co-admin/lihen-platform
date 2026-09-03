export type CatalogRenderIntegrityStatus =
  | 'READY'
  | 'BLOCKED_STYLE_PREVIEW'
  | 'BLOCKED_EMPTY'
  | 'BLOCKED_ASSET_FAILURE'
  | 'BLOCKED_PENDING_ASSETS';

export interface CatalogRenderIntegrityInput {
  readonly stylePreviewRequested: boolean;
  readonly expectedImages: number;
  readonly loadedImages: number;
  readonly failedImages: number;
  readonly expectedExtras: number;
  readonly loadedExtras: number;
  readonly failedExtras: number;
}

export interface CatalogRenderIntegritySnapshot {
  readonly status: CatalogRenderIntegrityStatus;
  readonly canPrint: boolean;
  readonly processedImages: number;
  readonly processedExtras: number;
  readonly failedAssets: number;
  readonly imagesReady: boolean;
  readonly extrasReady: boolean;
  readonly hasFailures: boolean;
}

export function evaluateCatalogRenderIntegrity(
  input: CatalogRenderIntegrityInput,
): CatalogRenderIntegritySnapshot {
  assertCounter('expectedImages', input.expectedImages);
  assertCounter('loadedImages', input.loadedImages);
  assertCounter('failedImages', input.failedImages);
  assertCounter('expectedExtras', input.expectedExtras);
  assertCounter('loadedExtras', input.loadedExtras);
  assertCounter('failedExtras', input.failedExtras);

  const processedImages = input.loadedImages + input.failedImages;
  const processedExtras = input.loadedExtras + input.failedExtras;
  const failedAssets = input.failedImages + input.failedExtras;
  const imagesReady =
    input.expectedImages > 0 && processedImages === input.expectedImages;
  const extrasReady = processedExtras === input.expectedExtras;
  const hasFailures = failedAssets > 0;

  let status: CatalogRenderIntegrityStatus = 'READY';

  if (input.stylePreviewRequested) {
    status = 'BLOCKED_STYLE_PREVIEW';
  } else if (input.expectedImages === 0) {
    status = 'BLOCKED_EMPTY';
  } else if (hasFailures) {
    status = 'BLOCKED_ASSET_FAILURE';
  } else if (!imagesReady || !extrasReady) {
    status = 'BLOCKED_PENDING_ASSETS';
  }

  return Object.freeze({
    status,
    canPrint: status === 'READY',
    processedImages,
    processedExtras,
    failedAssets,
    imagesReady,
    extrasReady,
    hasFailures,
  });
}

function assertCounter(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
}
