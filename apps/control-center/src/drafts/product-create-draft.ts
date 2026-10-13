import type { BrandDTO, CategoryDTO, ProductDetailDTO } from '@lihen/products';
import type { DraftCodec } from './local-form-draft';

export interface ProductCreateDraft {
  readonly sku: string;
  readonly catalogCode: string;
  readonly name: string;
  readonly businessLine: 'BEAUTY_CARE' | 'STYLE';
  readonly brandId: string;
  readonly categoryId: string;
  readonly status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED' | 'ARCHIVED';
}

export const emptyProductCreateDraft: ProductCreateDraft = {
  sku: '',
  catalogCode: '',
  name: '',
  businessLine: 'BEAUTY_CARE',
  brandId: '',
  categoryId: '',
  status: 'INACTIVE',
};

export const provisionalProductIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Commercial price is intentionally excluded, together with credentials, notes and files. */
export const productCreateDraftCodec: DraftCodec<ProductCreateDraft> = {
  parse(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Invalid creation draft.');
    const row = value as Record<string, unknown>;
    const keys = Object.keys(emptyProductCreateDraft);
    if (
      Object.keys(row).length !== keys.length ||
      keys.some((key) => typeof row[key] !== 'string' || (row[key] as string).length > 500)
    )
      throw new Error('Unreviewed creation fields.');
    if (
      !['BEAUTY_CARE', 'STYLE'].includes(String(row.businessLine)) ||
      !['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'ARCHIVED'].includes(String(row.status))
    )
      throw new Error('Invalid creation enum.');
    return {
      sku: String(row.sku),
      catalogCode: String(row.catalogCode),
      name: String(row.name),
      businessLine: row.businessLine as ProductCreateDraft['businessLine'],
      brandId: String(row.brandId),
      categoryId: String(row.categoryId),
      status: row.status as ProductCreateDraft['status'],
    };
  },
};

export function normalizeProductCreateDraft(value: ProductCreateDraft): ProductCreateDraft {
  return {
    ...productCreateDraftCodec.parse(value),
    sku: value.sku.trim(),
    catalogCode: value.catalogCode.trim(),
    name: value.name.trim(),
    brandId: value.brandId.trim(),
    categoryId: value.categoryId.trim(),
  };
}

export function createDraftTaxonomyError(
  value: ProductCreateDraft,
  brands: readonly BrandDTO[],
  categories: readonly CategoryDTO[],
): string | null {
  if (
    value.brandId &&
    !brands.some((brand) => brand.id === value.brandId && brand.status === 'ACTIVE')
  )
    return 'La marca restaurada ya no es canónica y activa. Selecciona otra marca.';
  if (
    value.categoryId &&
    !categories.some(
      (category) =>
        category.id === value.categoryId &&
        category.status === 'ACTIVE' &&
        category.businessLine === value.businessLine,
    )
  )
    return 'La categoría restaurada ya no es activa o compatible. Revisa la selección.';
  return null;
}

export function productCreateReadbackValues(product: ProductDetailDTO): ProductCreateDraft {
  return {
    sku: product.sku ?? '',
    catalogCode: product.catalogCode ?? '',
    name: product.name,
    businessLine: product.businessLine,
    brandId: product.brandId ?? '',
    categoryId: product.categoryId ?? '',
    status: product.status,
  };
}
