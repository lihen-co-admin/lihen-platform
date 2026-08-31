import type { CatalogRenderEntry } from './catalogs';
import { STYLE_VISUAL_FOUNDATION } from './catalog-style-visual';

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
    requiredPipeline: [
      'DETECT_PRIMARY_SUBJECT',
      'REMOVE_OR_CLEAN_BACKGROUND',
      'PRESERVE_PRODUCT_FIDELITY',
      'REFRAME_FOR_EDITORIAL_LAYOUT',
      'INTEGRATE_ON_STYLE_BACKGROUND',
    ],
    facePolicy: STYLE_VISUAL_FOUNDATION.facePolicy.mode,
    forbidden: [
      'CHANGE_MODEL',
      'REBUILD_FACE',
      'INVENT_ANATOMY',
      'TRANSFORM_PRODUCT',
      'ALTER_PRODUCT_COLOR',
      'INVENT_PRODUCT_DETAILS',
    ],
  },
} as const;

export function getStyleProductImagePreparation(entry: CatalogRenderEntry) {
  return {
    mode: 'CUTOUT_REQUIRED' as const,
    sourceUrl: entry.imageUrl,
    alt: entry.imageAlt || entry.productName,
  };
}

export function getStyleProductReference(entry: CatalogRenderEntry): string {
  return entry.sku || entry.productCatalogCode || entry.businessLine;
}
