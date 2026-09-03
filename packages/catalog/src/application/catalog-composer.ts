import {
  createCatalogRenderModelVNext,
  type CatalogRenderBrandVisualSnapshot,
  type CatalogRenderBusinessLine,
  type CatalogRenderInstitutionalSnapshot,
  type CatalogRenderModelVNext,
  type CatalogRenderPdfAssetSnapshot,
  type CatalogRenderProductSnapshot,
  type CatalogRenderScope,
  type CatalogRenderVersionSnapshot,
} from '../domain/catalog-render-model-vnext';

export interface CatalogComposerResolvedPdfAsset {
  readonly assetId: string;
  readonly publicUrl: string;
  readonly altText: string | null;
  readonly sourceId: string | null;
}

export interface CatalogComposerCanonicalBrandVisual {
  readonly source: 'CANONICAL_BRAND_ASSET';
  readonly assetId: string;
  readonly publicUrl: string;
  readonly kind: 'LOGO' | 'WORDMARK' | 'ISOTYPE' | 'LOCKUP';
  readonly approvalMode:
    | 'MANUAL_VERIFIED'
    | 'AUTO_VERIFIED'
    | 'CANDIDATE'
    | 'REQUIRES_REVIEW';
}

export interface CatalogComposerLegacyBrandVisual {
  readonly source: 'LEGACY_COMPATIBILITY';
  readonly assetId: string | null;
  readonly publicUrl: string;
  readonly kind: 'LOGO' | 'WORDMARK' | 'ISOTYPE' | 'LOCKUP' | null;
}

export type CatalogComposerBrandVisual =
  | CatalogComposerCanonicalBrandVisual
  | CatalogComposerLegacyBrandVisual;

export interface CatalogComposerSourceEntry {
  readonly catalogEntryId: string;
  readonly catalogVersionId: string;
  readonly productId: string;
  readonly sku: string | null;
  readonly productCatalogCode: string | null;
  readonly slug: string;
  readonly productName: string;
  readonly businessLine: CatalogRenderBusinessLine;
  readonly brandId: string | null;
  readonly brandName: string | null;
  readonly category: string | null;
  readonly subcategory: string | null;
  readonly description: string | null;
  readonly salePriceSnapshot: number;
  readonly legacyImageUrl: string | null;
  readonly legacyImageAlt: string | null;
  readonly resolvedPdfAsset?: CatalogComposerResolvedPdfAsset;
  readonly brandVisual?: CatalogComposerBrandVisual;
  readonly sortOrder: number;
}

export interface CatalogComposerInput {
  readonly version: CatalogRenderVersionSnapshot;
  readonly scope: CatalogRenderScope;
  readonly entries: readonly CatalogComposerSourceEntry[];
  readonly institutional: CatalogRenderInstitutionalSnapshot | null;
}

export interface CatalogComposerResult {
  readonly model: CatalogRenderModelVNext;
  readonly sourceEntryCount: number;
  readonly composedEntryCount: number;
  readonly filteredEntryCount: number;
  readonly channelSelectedAssetCount: number;
  readonly legacyAssetFallbackCount: number;
  readonly canonicalBrandVisualCount: number;
  readonly legacyBrandVisualCount: number;
  readonly textOnlyBrandCount: number;
}

export function composeCatalogRenderModel(
  input: CatalogComposerInput,
): CatalogComposerResult {
  validateSourceEntries(input.version, input.entries);

  const scopedEntries =
    input.scope === 'ALL'
      ? input.entries
      : input.entries.filter((entry) => entry.businessLine === input.scope);

  const renderEntries = scopedEntries.map(composeEntry);
  const model = createCatalogRenderModelVNext({
    version: input.version,
    scope: input.scope,
    entries: renderEntries,
    institutional: input.institutional,
  });

  const channelSelectedAssetCount = model.entries.filter(
    (entry) => entry.selectedPdfAsset.resolutionSource === 'CHANNEL_SELECTION',
  ).length;
  const canonicalBrandVisualCount = model.entries.filter(
    (entry) => entry.brand.visual.source === 'CANONICAL_BRAND_ASSET',
  ).length;
  const legacyBrandVisualCount = model.entries.filter(
    (entry) => entry.brand.visual.source === 'LEGACY_COMPATIBILITY',
  ).length;

  return Object.freeze({
    model,
    sourceEntryCount: input.entries.length,
    composedEntryCount: model.entries.length,
    filteredEntryCount: input.entries.length - model.entries.length,
    channelSelectedAssetCount,
    legacyAssetFallbackCount:
      model.entries.length - channelSelectedAssetCount,
    canonicalBrandVisualCount,
    legacyBrandVisualCount,
    textOnlyBrandCount:
      model.entries.length -
      canonicalBrandVisualCount -
      legacyBrandVisualCount,
  });
}

function validateSourceEntries(
  version: CatalogRenderVersionSnapshot,
  entries: readonly CatalogComposerSourceEntry[],
): void {
  const versionId = version.catalogVersionId.trim();
  if (!versionId) {
    throw new Error('Catalog Composer catalogVersionId is required.');
  }

  const entryIds = new Set<string>();

  for (const entry of entries) {
    if (entry.catalogVersionId !== versionId) {
      throw new Error(
        'Catalog Composer source entries must belong to the requested catalogVersionId.',
      );
    }

    if (entryIds.has(entry.catalogEntryId)) {
      throw new Error(
        `Catalog Composer cannot contain duplicate catalogEntryId ${entry.catalogEntryId}.`,
      );
    }
    entryIds.add(entry.catalogEntryId);

    if (
      entry.resolvedPdfAsset &&
      !entry.resolvedPdfAsset.assetId.trim()
    ) {
      throw new Error(
        'Catalog Composer resolved CATALOG_PDF asset requires assetId.',
      );
    }

    if (
      entry.brandVisual?.source === 'CANONICAL_BRAND_ASSET' &&
      !entry.brandId?.trim()
    ) {
      throw new Error(
        'Catalog Composer canonical Brand Asset requires brandId.',
      );
    }
  }
}

function composeEntry(
  entry: CatalogComposerSourceEntry,
): CatalogRenderProductSnapshot {
  return {
    catalogEntryId: entry.catalogEntryId,
    catalogVersionId: entry.catalogVersionId,
    productId: entry.productId,
    sku: entry.sku,
    productCatalogCode: entry.productCatalogCode,
    slug: entry.slug,
    productName: entry.productName,
    businessLine: entry.businessLine,
    brand: {
      brandId: normalizeNullable(entry.brandId),
      name: normalizeBrandName(entry.brandName),
      visual: composeBrandVisual(entry),
    },
    category: entry.category,
    subcategory: entry.subcategory,
    description: entry.description,
    salePriceSnapshot: entry.salePriceSnapshot,
    selectedPdfAsset: composePdfAsset(entry),
    sortOrder: entry.sortOrder,
  };
}

function composePdfAsset(
  entry: CatalogComposerSourceEntry,
): CatalogRenderPdfAssetSnapshot {
  if (entry.resolvedPdfAsset) {
    return Object.freeze({
      assetId: entry.resolvedPdfAsset.assetId,
      publicUrl: entry.resolvedPdfAsset.publicUrl,
      altText: entry.resolvedPdfAsset.altText,
      sourceId: entry.resolvedPdfAsset.sourceId,
      resolutionSource: 'CHANNEL_SELECTION',
    });
  }

  const legacyImageUrl = entry.legacyImageUrl?.trim();
  if (!legacyImageUrl) {
    throw new Error(
      `Catalog Composer entry ${entry.catalogEntryId} has no resolved CATALOG_PDF asset and no legacy render image fallback.`,
    );
  }

  return Object.freeze({
    assetId: null,
    publicUrl: legacyImageUrl,
    altText: entry.legacyImageAlt,
    sourceId: null,
    resolutionSource: 'LEGACY_RENDER_PROJECTION',
  });
}

function composeBrandVisual(
  entry: CatalogComposerSourceEntry,
): CatalogRenderBrandVisualSnapshot {
  if (entry.brandVisual?.source === 'CANONICAL_BRAND_ASSET') {
    return Object.freeze({
      source: 'CANONICAL_BRAND_ASSET',
      assetId: entry.brandVisual.assetId,
      publicUrl: entry.brandVisual.publicUrl,
      kind: entry.brandVisual.kind,
      approvalMode: entry.brandVisual.approvalMode,
    });
  }

  if (entry.brandVisual?.source === 'LEGACY_COMPATIBILITY') {
    return Object.freeze({
      source: 'LEGACY_COMPATIBILITY',
      assetId: normalizeNullable(entry.brandVisual.assetId),
      publicUrl: entry.brandVisual.publicUrl,
      kind: entry.brandVisual.kind,
      approvalMode: null,
    });
  }

  return Object.freeze({
    source: 'TEXT_ONLY',
    assetId: null,
    publicUrl: null,
    kind: null,
    approvalMode: null,
  });
}

function normalizeBrandName(value: string | null): string {
  return value?.trim() || 'LIHEN';
}

function normalizeNullable(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

/**
 * GAP-023 owns pure catalog composition:
 *
 * source/snapshot data -> scope -> explicit compatibility/canonical resolution
 * -> CatalogRenderModelVNext.
 *
 * It does not query Supabase, decide which Product/Brand Asset is canonically
 * correct, group or paginate PDF sheets, apply STYLE editorial templates,
 * format prices, render React, print, publish, or implement the Render
 * Integrity Guard.
 *
 * A resolvedPdfAsset means Channel Asset Selection has already happened
 * upstream. Falling back to legacyImageUrl is explicit migration compatibility
 * and remains tagged LEGACY_RENDER_PROJECTION in the output model.
 */
