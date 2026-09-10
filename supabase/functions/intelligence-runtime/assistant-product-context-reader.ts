import type { SupabaseClient } from 'supabase';

const PRODUCT_COLUMNS =
  'id,sku,catalog_code,slug,name,business_line,status,sale_price,brand_id,category_id';

interface ProductRow {
  readonly id: unknown;
  readonly sku: unknown;
  readonly catalog_code: unknown;
  readonly slug: unknown;
  readonly name: unknown;
  readonly business_line: unknown;
  readonly status: unknown;
  readonly sale_price: unknown;
  readonly brand_id: unknown;
  readonly category_id: unknown;
}

interface TaxonomyRow {
  readonly name: unknown;
}

export interface AssistantProductDetail {
  readonly id: string;
  readonly sku?: string;
  readonly catalogCode?: string;
  readonly slug: string;
  readonly name: string;
  readonly businessLine: 'BEAUTY_CARE' | 'STYLE';
  readonly brandId?: string;
  readonly brandName?: string;
  readonly categoryId?: string;
  readonly categoryName?: string;
  readonly status:
    | 'ACTIVE'
    | 'INACTIVE'
    | 'DISCONTINUED'
    | 'ARCHIVED';
  readonly salePrice: {
    readonly amount: number;
    readonly currency: 'COP';
  };
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim();
  return normalized || undefined;
}

function requiredText(
  value: unknown,
  field: string,
): string {
  const normalized = optionalText(value);

  if (!normalized) {
    throw new Error(
      `LIHEN_ASSISTANT_PRODUCT_INVALID:${field}`,
    );
  }

  return normalized;
}

function businessLine(
  value: unknown,
): AssistantProductDetail['businessLine'] {
  const normalized = requiredText(
    value,
    'business_line',
  ).toUpperCase();

  if (
    normalized !== 'BEAUTY_CARE'
    && normalized !== 'STYLE'
  ) {
    throw new Error(
      `LIHEN_ASSISTANT_PRODUCT_INVALID:business_line:${normalized}`,
    );
  }

  return normalized;
}

function productStatus(
  value: unknown,
): AssistantProductDetail['status'] {
  const normalized = requiredText(
    value,
    'status',
  ).toUpperCase();

  const aliases: Readonly<
    Record<string, AssistantProductDetail['status']>
  > = {
    ACTIVE: 'ACTIVE',
    ACTIVO: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    INACTIVO: 'INACTIVE',
    DISCONTINUED: 'DISCONTINUED',
    DESCONTINUADO: 'DISCONTINUED',
    ARCHIVED: 'ARCHIVED',
    ARCHIVADO: 'ARCHIVED',
  };

  const mapped = aliases[normalized];

  if (!mapped) {
    throw new Error(
      `LIHEN_ASSISTANT_PRODUCT_INVALID:status:${normalized}`,
    );
  }

  return mapped;
}

function salePrice(value: unknown): number {
  const amount =
    typeof value === 'number'
      ? value
      : Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(
      `LIHEN_ASSISTANT_PRODUCT_INVALID:sale_price:${String(value)}`,
    );
  }

  return amount;
}

async function taxonomyName(
  client: SupabaseClient,
  table: 'brands' | 'categories',
  id: string | undefined,
): Promise<string | undefined> {
  if (!id) return undefined;

  const { data, error } = await client
    .from(table)
    .select('name')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(
      `LIHEN_ASSISTANT_${table.toUpperCase()}_READ_FAILED:${
        error.message ?? 'UNKNOWN'
      }`,
    );
  }

  if (!data) return undefined;

  return optionalText(
    (data as unknown as TaxonomyRow).name,
  );
}

export async function readAssistantProductContext(
  client: SupabaseClient,
  productId: string,
): Promise<AssistantProductDetail | null> {
  const normalizedProductId = productId.trim();

  if (!normalizedProductId) {
    throw new Error(
      'LIHEN_ASSISTANT_PRODUCT_ID_REQUIRED',
    );
  }

  const { data, error } = await client
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('id', normalizedProductId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `LIHEN_ASSISTANT_PRODUCT_READ_FAILED:${
        error.message ?? 'UNKNOWN'
      }`,
    );
  }

  if (!data) return null;

  const row = data as unknown as ProductRow;

  const brandId = optionalText(row.brand_id);
  const categoryId = optionalText(row.category_id);

  const [brandName, categoryName] = await Promise.all([
    taxonomyName(client, 'brands', brandId),
    taxonomyName(client, 'categories', categoryId),
  ]);

  return {
    id: requiredText(row.id, 'id'),
    ...(optionalText(row.sku)
      ? { sku: optionalText(row.sku) }
      : {}),
    ...(optionalText(row.catalog_code)
      ? { catalogCode: optionalText(row.catalog_code) }
      : {}),
    slug: requiredText(row.slug, 'slug'),
    name: requiredText(row.name, 'name'),
    businessLine: businessLine(row.business_line),
    ...(brandId ? { brandId } : {}),
    ...(brandName ? { brandName } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(categoryName ? { categoryName } : {}),
    status: productStatus(row.status),
    salePrice: {
      amount: salePrice(row.sale_price),
      currency: 'COP',
    },
  };
}
