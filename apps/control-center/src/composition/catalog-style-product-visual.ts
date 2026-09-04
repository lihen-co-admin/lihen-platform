import type { CatalogRenderProductSnapshot } from '@lihen/catalog';
import { STYLE_VISUAL_FOUNDATION } from './catalog-style-visual';
import {
  resolveStyleEditorialAsset,
  STYLE_EDITORIAL_POLICY,
} from './catalog-style-editorial-policy';

export const STYLE_PRODUCT_VISUAL_CONTRACT = {
  identity: 'LIHEN.CO STYLE',
  collectionLabel: 'COLECCIÓN 2026',
  pricePolicy: {
    visiblePrice: 'SALE_PRICE_ONLY',
    label: 'Precio por unidad',
    forbiddenLabels: [
      'Precio por mayor',
      'Mayor',
      'X mayor',
      'Precio mayorista',
      'Agotado',
      'Consultar precio',
    ],
  },
  imagePreparation: {
    requiredPipeline: STYLE_EDITORIAL_POLICY.imagePreparation.allowed,
    facePolicy: STYLE_VISUAL_FOUNDATION.facePolicy.mode,
    forbidden: STYLE_EDITORIAL_POLICY.imagePreparation.forbidden,
  },
} as const;

export function getStyleProductImagePreparation(
  entry: CatalogRenderProductSnapshot,
) {
  const editorialAsset = resolveStyleEditorialAsset(entry);

  return {
    mode: STYLE_EDITORIAL_POLICY.imagePreparation.mode,
    sourceUrl: editorialAsset.sourcePublicUrl,
    alt: editorialAsset.sourceAltText || entry.productName,
    editorialRole: editorialAsset.role,
    canonicalAuthority: editorialAsset.canonicalAuthority,
  };
}

export function getStyleProductReference(
  entry: CatalogRenderProductSnapshot,
): string {
  return entry.sku || entry.productCatalogCode || entry.businessLine;
}
