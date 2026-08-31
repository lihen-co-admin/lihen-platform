import type { CatalogRenderEntry } from './catalogs';
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
  entry: CatalogRenderEntry;
};

export type StyleCatalogCategoryPage = {
  type: 'style-category';
  label: string;
  coverKey: import('./catalog-style-category-covers').StyleCategoryCoverKey;
};

export type StyleCatalogBodyPage = StyleCatalogProductPage | StyleCatalogCategoryPage;

function styleCategorySource(entry: CatalogRenderEntry): string {
  const extended = entry as CatalogRenderEntry & {
    category?: string | null;
    categoryName?: string | null;
    subcategory?: string | null;
  };

  return (
    extended.categoryName?.trim()
    || extended.category?.trim()
    || extended.subcategory?.trim()
    || entry.productName.trim()
    || entry.brand?.trim()
    || 'LIHEN STYLE'
  );
}

function normalizeStyleGroup(entry: CatalogRenderEntry): string {
  return resolveStyleCategoryLabel(styleCategorySource(entry));
}

export function buildStyleBodyPages(
  entries: readonly CatalogRenderEntry[],
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

export function getStyleCtaLabel(entry: CatalogRenderEntry): string {
  const text = `${entry.productName} ${entry.imageAlt ?? ''}`.toLocaleLowerCase('es-CO');

  if (/\b(color|colores|tono|tonos)\b/.test(text)) return 'VER COLORES';
  if (/\b(referencia|referencias|ref\.)\b/.test(text)) return 'VER REFERENCIAS';

  return 'VER OPCIONES';
}

export function getStyleMicrocopy(entry: CatalogRenderEntry): string {
  const brand = entry.brand?.trim();
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
