import type { CatalogRenderEntry } from './catalogs';

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

function fixture(
  base: CatalogRenderEntry,
  partial: Pick<
    CatalogRenderEntry,
    | 'catalogEntryId'
    | 'productId'
    | 'sku'
    | 'productCatalogCode'
    | 'slug'
    | 'productName'
    | 'businessLine'
    | 'brand'
    | 'category'
    | 'subcategory'
    | 'description'
    | 'salePrice'
    | 'imageUrl'
    | 'imageAlt'
    | 'sortOrder'
  >,
): CatalogRenderEntry {
  return {
    ...base,
    ...partial,
  };
}

export function buildStyleCommercialBodyPreview(
  base: CatalogRenderEntry,
): readonly CatalogRenderEntry[] {
  return [
    fixture(base, {
      catalogEntryId: 'dev-style-preview-enterizo',
      productId: 'dev-style-preview-enterizo',
      sku: 'S04',
      productCatalogCode: 'S04',
      slug: 'dev-enterizo-short-deportivo-seamless',
      productName: 'Enterizo short deportivo seamless',
      businessLine: 'STYLE',
      brand: 'LIHEN STYLE',
      category: 'Enterizos deportivos',
      subcategory: 'Enterizos',
      description: 'Fixture visual DEV. No forma parte del snapshot.',
      salePrice: 53500,
      imageUrl: previewEnterizo,
      imageAlt: 'Enterizo deportivo · colores disponibles',
      sortOrder: 10,
    }),
    fixture(base, {
      catalogEntryId: 'dev-style-preview-falda-top',
      productId: 'dev-style-preview-falda-top',
      sku: 'S14',
      productCatalogCode: 'S14',
      slug: 'dev-conjunto-falda-short-top',
      productName: 'Conjunto deportivo falda-short + top',
      businessLine: 'STYLE',
      brand: 'LIHEN STYLE',
      category: 'Conjuntos deportivos / Falda + Top',
      subcategory: 'Falda + Top',
      description: 'Fixture visual DEV. No forma parte del snapshot.',
      salePrice: 65000,
      imageUrl: previewFaldaTop,
      imageAlt: 'Conjunto falda short y top · colores disponibles',
      sortOrder: 20,
    }),
    fixture(base, {
      catalogEntryId: 'dev-style-preview-shorts',
      productId: 'dev-style-preview-shorts',
      sku: 'SXX-SHORT',
      productCatalogCode: 'STYLE-SHORT',
      slug: 'dev-short-deportivo-con-cordon',
      productName: 'Short deportivo con cordón',
      businessLine: 'STYLE',
      brand: 'LIHEN STYLE',
      category: 'Shorts deportivos',
      subcategory: 'Shorts',
      description: 'Fixture visual DEV. No forma parte del snapshot.',
      salePrice: 45000,
      imageUrl: previewShorts,
      imageAlt: 'Short deportivo · colores disponibles',
      sortOrder: 30,
    }),
    fixture(base, {
      catalogEntryId: 'dev-style-preview-hombre',
      productId: 'dev-style-preview-hombre',
      sku: 'S11',
      productCatalogCode: 'S11',
      slug: 'dev-conjunto-deportivo-hombre',
      productName: 'Conjunto deportivo hombre camiseta + short',
      businessLine: 'STYLE',
      brand: 'LIHEN STYLE',
      category: 'Hombre',
      subcategory: 'Conjuntos deportivos hombre',
      description: 'Fixture visual DEV. No forma parte del snapshot.',
      salePrice: 65000,
      imageUrl: previewHombre,
      imageAlt: 'Conjunto deportivo hombre · referencias disponibles',
      sortOrder: 40,
    }),
  ];
}
