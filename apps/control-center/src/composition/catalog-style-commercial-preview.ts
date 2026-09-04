import type { CatalogRenderProductSnapshot } from '@lihen/catalog';

import previewEnterizo from '../assets/catalog/style/dev-preview/preview-enterizo.png';
import previewFaldaTop from '../assets/catalog/style/dev-preview/preview-falda-top.png';
import previewShorts from '../assets/catalog/style/dev-preview/preview-shorts.png';
import previewHombre from '../assets/catalog/style/dev-preview/preview-hombre.png';

export const STYLE_COMMERCIAL_BODY_PREVIEW = {
  mode: 'DEV_ONLY',
  queryParam: 'stylePreview',
  enabledValue: '1',
  source: 'LOCAL_EDITORIAL_FIXTURES',
  publicationAllowed: false,
  snapshotMutationAllowed: false,
} as const;

export type StyleCommercialPreviewSeed = {
  readonly catalogVersionId: string;
};

type StylePreviewFixtureInput = {
  readonly catalogEntryId: string;
  readonly productId: string;
  readonly sku: string;
  readonly productCatalogCode: string;
  readonly slug: string;
  readonly productName: string;
  readonly category: string;
  readonly subcategory: string;
  readonly salePriceSnapshot: number;
  readonly publicUrl: string;
  readonly altText: string;
  readonly sortOrder: number;
};

function fixture(
  seed: StyleCommercialPreviewSeed,
  input: StylePreviewFixtureInput,
): CatalogRenderProductSnapshot {
  return Object.freeze({
    catalogEntryId: input.catalogEntryId,
    catalogVersionId: seed.catalogVersionId,
    productId: input.productId,
    sku: input.sku,
    productCatalogCode: input.productCatalogCode,
    slug: input.slug,
    productName: input.productName,
    businessLine: 'STYLE',
    brand: Object.freeze({
      brandId: null,
      name: 'LIHEN STYLE',
      visual: Object.freeze({
        source: 'TEXT_ONLY',
        assetId: null,
        publicUrl: null,
        kind: null,
        approvalMode: null,
      }),
    }),
    category: input.category,
    subcategory: input.subcategory,
    description: 'Fixture visual DEV. No forma parte del snapshot publicado.',
    salePriceSnapshot: input.salePriceSnapshot,
    selectedPdfAsset: Object.freeze({
      assetId: null,
      publicUrl: input.publicUrl,
      altText: input.altText,
      sourceId: 'DEV_LOCAL_EDITORIAL_FIXTURE',
      resolutionSource: 'LEGACY_RENDER_PROJECTION',
    }),
    sortOrder: input.sortOrder,
  });
}

export function buildStyleCommercialBodyPreview(
  seed: StyleCommercialPreviewSeed,
): readonly CatalogRenderProductSnapshot[] {
  return Object.freeze([
    fixture(seed, {
      catalogEntryId: 'dev-style-preview-enterizo',
      productId: 'dev-style-preview-enterizo',
      sku: 'S04',
      productCatalogCode: 'S04',
      slug: 'dev-enterizo-short-deportivo-seamless',
      productName: 'Enterizo short deportivo seamless',
      category: 'Enterizos deportivos',
      subcategory: 'Enterizos',
      salePriceSnapshot: 53500,
      publicUrl: previewEnterizo,
      altText: 'Enterizo deportivo · colores disponibles',
      sortOrder: 10,
    }),
    fixture(seed, {
      catalogEntryId: 'dev-style-preview-falda-top',
      productId: 'dev-style-preview-falda-top',
      sku: 'S14',
      productCatalogCode: 'S14',
      slug: 'dev-conjunto-falda-short-top',
      productName: 'Conjunto deportivo falda-short + top',
      category: 'Conjuntos deportivos / Falda + Top',
      subcategory: 'Falda + Top',
      salePriceSnapshot: 65000,
      publicUrl: previewFaldaTop,
      altText: 'Conjunto falda short y top · colores disponibles',
      sortOrder: 20,
    }),
    fixture(seed, {
      catalogEntryId: 'dev-style-preview-shorts',
      productId: 'dev-style-preview-shorts',
      sku: 'SXX-SHORT',
      productCatalogCode: 'STYLE-SHORT',
      slug: 'dev-short-deportivo-con-cordon',
      productName: 'Short deportivo con cordón',
      category: 'Shorts deportivos',
      subcategory: 'Shorts',
      salePriceSnapshot: 45000,
      publicUrl: previewShorts,
      altText: 'Short deportivo · colores disponibles',
      sortOrder: 30,
    }),
    fixture(seed, {
      catalogEntryId: 'dev-style-preview-hombre',
      productId: 'dev-style-preview-hombre',
      sku: 'S11',
      productCatalogCode: 'S11',
      slug: 'dev-conjunto-deportivo-hombre',
      productName: 'Conjunto deportivo hombre camiseta + short',
      category: 'Hombre',
      subcategory: 'Conjuntos deportivos hombre',
      salePriceSnapshot: 65000,
      publicUrl: previewHombre,
      altText: 'Conjunto deportivo hombre · referencias disponibles',
      sortOrder: 40,
    }),
  ]);
}
