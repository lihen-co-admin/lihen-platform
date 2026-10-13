import type { ProductDetailDTO } from '@lihen/products';
import type { DraftCodec } from './local-form-draft';

/** Catalog identity only. No pricing, customer data, free notes, files or session material. */
export interface ProductEditDraft {
  readonly sku: string;
  readonly slug: string;
  readonly catalogCode: string;
  readonly name: string;
  readonly businessLine: 'BEAUTY_CARE' | 'STYLE';
  readonly brandId: string;
  readonly categoryId: string;
  readonly status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED' | 'ARCHIVED';
}

export const emptyProductEditDraft: ProductEditDraft = {
  sku: '',
  slug: '',
  catalogCode: '',
  name: '',
  businessLine: 'BEAUTY_CARE',
  brandId: '',
  categoryId: '',
  status: 'ACTIVE',
};

export const productEditDraftCodec: DraftCodec<ProductEditDraft> = {
  parse(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Invalid product draft.');
    const row = value as Record<string, unknown>;
    const keys = Object.keys(emptyProductEditDraft);
    if (
      Object.keys(row).length !== keys.length ||
      keys.some((key) => typeof row[key] !== 'string' || (row[key] as string).length > 500)
    )
      throw new Error('Unreviewed draft fields.');
    if (
      !['BEAUTY_CARE', 'STYLE'].includes(String(row.businessLine)) ||
      !['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'ARCHIVED'].includes(String(row.status))
    )
      throw new Error('Invalid draft enum.');
    return {
      sku: String(row.sku).trim(),
      slug: String(row.slug),
      catalogCode: String(row.catalogCode).trim(),
      name: String(row.name),
      businessLine: row.businessLine as ProductEditDraft['businessLine'],
      brandId: String(row.brandId),
      categoryId: String(row.categoryId),
      status: row.status as ProductEditDraft['status'],
    };
  },
};

export function productEditValues(product: ProductDetailDTO): ProductEditDraft {
  return {
    sku: product.sku ?? '',
    slug: product.slug,
    catalogCode: product.catalogCode ?? '',
    name: product.name,
    businessLine: product.businessLine,
    brandId: product.brandId ?? '',
    categoryId: product.categoryId ?? '',
    status: product.status,
  };
}
