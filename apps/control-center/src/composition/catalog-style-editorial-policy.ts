import type {
  CatalogRenderAssetResolutionSource,
  CatalogRenderProductSnapshot,
} from '@lihen/catalog';

export type StyleEditorialAsset = {
  readonly role: 'EDITORIAL_PRESENTATION';
  readonly canonicalAuthority: false;
  readonly mutationAllowed: false;
  readonly sourceAssetId: string | null;
  readonly sourcePublicUrl: string;
  readonly sourceAltText: string | null;
  readonly sourceId: string | null;
  readonly sourceResolution: CatalogRenderAssetResolutionSource;
};

export const STYLE_EDITORIAL_POLICY = Object.freeze({
  line: 'STYLE' as const,
  renderContract: 'CATALOG_RENDER_MODEL_VNEXT' as const,
  editorialAssetRole: 'PRESENTATION_ONLY' as const,
  editorialAssetIsCanonical: false as const,
  productAssetMutationAllowed: false as const,
  selectedPdfAssetReplacementAllowed: false as const,
  imagePreparation: Object.freeze({
    mode: 'CUTOUT_REQUIRED' as const,
    allowed: Object.freeze([
      'DETECT_PRIMARY_SUBJECT',
      'REMOVE_OR_CLEAN_BACKGROUND',
      'PRESERVE_PRODUCT_FIDELITY',
      'REFRAME_FOR_EDITORIAL_LAYOUT',
      'INTEGRATE_ON_STYLE_BACKGROUND',
    ] as const),
    forbidden: Object.freeze([
      'CHANGE_MODEL',
      'REBUILD_FACE',
      'INVENT_ANATOMY',
      'TRANSFORM_PRODUCT',
      'ALTER_PRODUCT_COLOR',
      'INVENT_PRODUCT_DETAILS',
    ] as const),
  }),
});

export function resolveStyleEditorialAsset(
  entry: CatalogRenderProductSnapshot,
): StyleEditorialAsset {
  if (entry.businessLine !== 'STYLE') {
    throw new Error('STYLE editorial policy only accepts STYLE render entries.');
  }

  return Object.freeze({
    role: 'EDITORIAL_PRESENTATION',
    canonicalAuthority: false,
    mutationAllowed: false,
    sourceAssetId: entry.selectedPdfAsset.assetId,
    sourcePublicUrl: entry.selectedPdfAsset.publicUrl,
    sourceAltText: entry.selectedPdfAsset.altText,
    sourceId: entry.selectedPdfAsset.sourceId,
    sourceResolution: entry.selectedPdfAsset.resolutionSource,
  });
}
