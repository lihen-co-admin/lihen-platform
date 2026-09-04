import type { CatalogRenderProductSnapshot } from '@lihen/catalog';
import {
  STYLE_VISUAL_FOUNDATION,
  getStyleTemplateSeed,
  type StyleEditorialTemplate,
} from './catalog-style-visual';
import {
  resolveStyleCategoryCoverKey,
  resolveStyleCategoryLabel,
} from './catalog-style-category-covers';

export type StyleCatalogProductPage = {
  type: 'style-product';
  template: StyleEditorialTemplate;
  entry: CatalogRenderProductSnapshot;
};

export type StyleCatalogCategoryPage = {
  type: 'style-category';
  label: string;
  coverKey: import('./catalog-style-category-covers').StyleCategoryCoverKey;
};

export type StyleCatalogBodyPage = StyleCatalogProductPage | StyleCatalogCategoryPage;

function styleCategorySource(entry: CatalogRenderProductSnapshot): string {
  return (
    entry.category?.trim()
    || entry.subcategory?.trim()
    || entry.productName.trim()
    || entry.brand.name.trim()
    || 'LIHEN STYLE'
  );
}

function normalizeStyleGroup(entry: CatalogRenderProductSnapshot): string {
  return resolveStyleCategoryLabel(styleCategorySource(entry));
}

export function buildStyleBodyPages(
  entries: readonly CatalogRenderProductSnapshot[],
): readonly StyleCatalogBodyPage[] {
  const result: StyleCatalogBodyPage[] = [];
  let previousGroup = '';

  entries.forEach((entry, index) => {
    const group = normalizeStyleGroup(entry);
    if (group !== previousGroup) {
      result.push({
        type: 'style-category',
        label: group,
        coverKey: resolveStyleCategoryCoverKey(styleCategorySource(entry)),
      });
      previousGroup = group;
    }

    result.push({
      type: 'style-product',
      template: getStyleTemplateSeed(index),
      entry,
    });
  });

  return result;
}

export function getStyleCtaLabel(entry: CatalogRenderProductSnapshot): string {
  const text = `${entry.productName} ${entry.selectedPdfAsset.altText ?? ''}`.toLocaleLowerCase('es-CO');

  if (/\b(color|colores|tono|tonos)\b/.test(text)) return 'VER COLORES';
  if (/\b(referencia|referencias|ref\.)\b/.test(text)) return 'VER REFERENCIAS';

  return 'VER OPCIONES';
}

export function getStyleMicrocopy(entry: CatalogRenderProductSnapshot): string {
  const brand = entry.brand.name.trim();
  if (brand) return `${brand} · selección LIHEN Style`;
  return 'Selección editorial LIHEN Style';
}

export const STYLE_TEMPLATE_LABELS: Record<StyleEditorialTemplate, string> = {
  A: 'EDITORIAL SPLIT',
  B: 'FASHION MAGAZINE',
  C: 'FRAME / ARCH',
  D: 'ADN LIHEN EVOLUCIONADO',
};

export const STYLE_FACE_POLICY_MODE = STYLE_VISUAL_FOUNDATION.facePolicy.mode;
