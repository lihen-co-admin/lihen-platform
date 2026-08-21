import type { SupabaseClient } from '@supabase/supabase-js';
import { Money, type Currency } from '@lihen/shared';
import type { Product } from '../domain/product';
import { ProductSalePriceChange } from '../domain/product-sale-price-change';
import {
  BrandNotFoundError,
  CategoryNotFoundError,
  DuplicateCatalogCodeError,
  DuplicateProductSkuError,
  ProductCreateForbiddenError,
  ProductUpdateForbiddenError,
  ProductNotFoundError,
  ProductPriceChangeForbiddenError,
  ProductSalePriceUnchangedError,
  ProductPriceHistoryUnavailableError,
  ProductPriceHistoryReadForbiddenError,
  ProductWriteBlockedError,
  ProductWriteOperationConflictError,
} from '../domain/errors/product-errors';
import type { ProductPriceWriteContext, ProductPricingRepository, ProductSalePriceWriteResult } from '../ports/product-pricing-repository';
import type { ProductRepository, ProductWriteContext } from '../ports/product-repository';
import { ControlledProductWriteMapper } from './controlled-product-write-mapper';
import { LegacyProductMapper } from './legacy-product-mapper';

const PRODUCT_READ_COLUMNS = 'id, sku, catalog_code, slug, name, business_line, status, sale_price, brand_id, category_id';

export interface SupabaseProductRepositoryOptions {
  readonly controlledCreateEnabled?: boolean;
  readonly controlledUpdateEnabled?: boolean;
  readonly controlledPriceChangeEnabled?: boolean;
  readonly priceHistoryReadEnabled?: boolean;
}

export class SupabaseProductRepository implements ProductRepository, ProductPricingRepository {
  private readonly controlledCreateEnabled: boolean;
  private readonly controlledUpdateEnabled: boolean;
  private readonly controlledPriceChangeEnabled: boolean;
  private readonly priceHistoryReadEnabled: boolean;

  public constructor(
    private readonly client: SupabaseClient,
    options: SupabaseProductRepositoryOptions = {},
  ) {
    this.controlledCreateEnabled = options.controlledCreateEnabled ?? false;
    this.controlledUpdateEnabled = options.controlledUpdateEnabled ?? false;
    this.controlledPriceChangeEnabled = options.controlledPriceChangeEnabled ?? false;
    this.priceHistoryReadEnabled = options.priceHistoryReadEnabled ?? false;
  }

  public async findAll(): Promise<readonly Product[]> {
    const { data, error } = await this.client
      .from('products')
      .select(PRODUCT_READ_COLUMNS)
      .order('name', { ascending: true });

    if (error) throw new Error(`Unable to read products from Supabase: ${error.message}`);
    return ((data ?? []) as unknown[]).map((row) => LegacyProductMapper.toDomain(row));
  }

  public async findById(id: string): Promise<Product | null> {
    const { data, error } = await this.client
      .from('products')
      .select(PRODUCT_READ_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Unable to read product from Supabase: ${error.message}`);
    return data ? LegacyProductMapper.toDomain(data) : null;
  }

  public async findBySku(sku: string): Promise<Product | null> {
    const { data, error } = await this.client
      .from('products')
      .select(PRODUCT_READ_COLUMNS)
      .eq('sku', sku.trim())
      .maybeSingle();
    if (error) throw new Error(`Unable to check product SKU in Supabase: ${error.message}`);
    return data ? LegacyProductMapper.toDomain(data) : null;
  }

  public async findByCatalogCode(catalogCode: string): Promise<Product | null> {
    const { data, error } = await this.client
      .from('products')
      .select(PRODUCT_READ_COLUMNS)
      .eq('catalog_code', catalogCode.trim())
      .maybeSingle();
    if (error) {
      throw new Error(`Unable to check product catalog code in Supabase: ${error.message}`);
    }
    return data ? LegacyProductMapper.toDomain(data) : null;
  }

  public async create(product: Product, context?: ProductWriteContext): Promise<Product> {
    if (!this.controlledCreateEnabled || !context) {
      throw new ProductWriteBlockedError();
    }

    const { data, error } = await this.client.rpc('create_product_controlled', {
      p_operation_key: context.operationKey,
      p_id: product.id,
      p_sku: product.sku ?? null,
      p_catalog_code: product.catalogCode ?? null,
      p_slug: product.slug,
      p_name: product.name,
      p_business_line: product.businessLine,
      p_brand_id: product.brandId ?? null,
      p_category_id: product.categoryId ?? null,
      p_status: product.status,
      p_sale_price: product.salePrice.amount,
    });

    if (error) {
      const message = error.message ?? '';
      const details = error.details ?? '';
      const combined = `${message} ${details}`;

      if (combined.includes('permission denied for function create_product_controlled')) {
        throw new ProductWriteBlockedError();
      }
      if (combined.includes('LIHEN_PRODUCT_CREATE_FORBIDDEN')) {
        throw new ProductCreateForbiddenError();
      }
      if (combined.includes('products_sku_unique_not_null')) {
        throw new DuplicateProductSkuError(product.sku ?? '');
      }
      if (combined.includes('products_catalog_code_unique_not_null')) {
        throw new DuplicateCatalogCodeError(product.catalogCode ?? '');
      }
      if (combined.includes('product_write_operations_pkey')) {
        throw new ProductWriteOperationConflictError(context.operationKey);
      }
      throw new Error(`Unable to create product through controlled RPC: ${message}`);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('Controlled CreateProduct RPC returned no product.');
    return ControlledProductWriteMapper.toDomain(row);
  }

  public async update(product: Product, context?: ProductWriteContext): Promise<Product> {
    if (!this.controlledUpdateEnabled || !context) {
      throw new ProductWriteBlockedError();
    }

    const { data, error } = await this.client.rpc('update_product_controlled', {
      p_operation_key: context.operationKey,
      p_product_id: product.id,
      p_sku: product.sku ?? null,
      p_catalog_code: product.catalogCode ?? null,
      p_slug: product.slug,
      p_name: product.name,
      p_business_line: product.businessLine,
      p_brand_id: product.brandId ?? null,
      p_category_id: product.categoryId ?? null,
      p_status: product.status,
    });

    if (error) {
      const message = error.message ?? '';
      const details = error.details ?? '';
      const combined = `${message} ${details}`;

      if (combined.includes('permission denied for function update_product_controlled')) {
        throw new ProductWriteBlockedError();
      }
      if (combined.includes('LIHEN_PRODUCT_UPDATE_FORBIDDEN')) {
        throw new ProductUpdateForbiddenError();
      }
      if (combined.includes('LIHEN_PRODUCT_NOT_FOUND')) {
        throw new ProductNotFoundError(product.id);
      }
      if (combined.includes('LIHEN_BRAND_NOT_FOUND')) {
        throw new BrandNotFoundError(product.brandId ?? '');
      }
      if (combined.includes('LIHEN_CATEGORY_NOT_FOUND')) {
        throw new CategoryNotFoundError(product.categoryId ?? '');
      }
      if (combined.includes('products_sku_unique_not_null')) {
        throw new DuplicateProductSkuError(product.sku ?? '');
      }
      if (combined.includes('products_catalog_code_unique_not_null')) {
        throw new DuplicateCatalogCodeError(product.catalogCode ?? '');
      }
      if (combined.includes('LIHEN_PRODUCT_WRITE_OPERATION_CONFLICT') || combined.includes('product_write_operations_pkey')) {
        throw new ProductWriteOperationConflictError(context.operationKey);
      }
      throw new Error(`Unable to update product through controlled RPC: ${message}`);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('Controlled UpdateProduct RPC returned no product.');
    return ControlledProductWriteMapper.toDomain(row);
  }

  public async changeSalePrice(
    product: Product,
    historyEntry: ProductSalePriceChange,
    context?: ProductPriceWriteContext,
  ): Promise<ProductSalePriceWriteResult> {
    if (!this.controlledPriceChangeEnabled || !context) {
      throw new ProductWriteBlockedError();
    }

    const { data, error } = await this.client.rpc('change_product_sale_price_controlled', {
      p_operation_key: context.operationKey,
      p_history_id: historyEntry.id,
      p_product_id: product.id,
      p_new_price: product.salePrice.amount,
      p_currency: product.salePrice.currency,
      p_reason: historyEntry.reason,
    });

    if (error) {
      const message = error.message ?? '';
      const details = error.details ?? '';
      const combined = `${message} ${details}`;

      if (combined.includes('permission denied for function change_product_sale_price_controlled')) {
        throw new ProductWriteBlockedError();
      }
      if (combined.includes('LIHEN_PRODUCT_PRICE_CHANGE_FORBIDDEN')) {
        throw new ProductPriceChangeForbiddenError();
      }
      if (combined.includes('LIHEN_PRODUCT_NOT_FOUND')) {
        throw new ProductNotFoundError(product.id);
      }
      if (combined.includes('LIHEN_PRODUCT_SALE_PRICE_UNCHANGED')) {
        throw new ProductSalePriceUnchangedError(product.salePrice.amount);
      }
      if (combined.includes('LIHEN_PRODUCT_WRITE_OPERATION_CONFLICT') || combined.includes('product_write_operations_pkey')) {
        throw new ProductWriteOperationConflictError(context.operationKey);
      }
      throw new Error(`Unable to change product price through controlled RPC: ${message}`);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('Controlled ChangeProductSalePrice RPC returned no result.');

    const persistedProduct = ControlledProductWriteMapper.toDomain(row, product.businessLine);
    const currency = String(row.currency);
    if (!['COP', 'USD', 'EUR'].includes(currency)) {
      throw new Error(`Controlled price RPC returned unsupported currency: ${currency}`);
    }
    const persistedHistory = new ProductSalePriceChange({
      id: String(row.history_id),
      productId: String(row.id),
      previousPrice: new Money(Number(row.previous_price), currency as Currency),
      newPrice: new Money(Number(row.sale_price), currency as Currency),
      reason: String(row.reason),
      actorId: String(row.actor_id),
      changedAt: new Date(String(row.changed_at)),
    });

    return { product: persistedProduct, historyEntry: persistedHistory };
  }

  public async findSalePriceHistoryByProductId(
    productId: string,
  ): Promise<readonly ProductSalePriceChange[]> {
    if (!this.priceHistoryReadEnabled) {
      throw new ProductPriceHistoryUnavailableError();
    }

    const { data, error } = await this.client.rpc('get_product_sale_price_history', {
      p_product_id: productId,
    });

    if (error) {
      const message = error.message ?? '';
      const details = error.details ?? '';
      const combined = `${message} ${details}`;

      if (combined.includes('permission denied for function get_product_sale_price_history')) {
        throw new ProductPriceHistoryUnavailableError();
      }
      if (combined.includes('LIHEN_PRODUCT_PRICE_HISTORY_READ_FORBIDDEN') || combined.includes('LIHEN_AUTH_REQUIRED')) {
        throw new ProductPriceHistoryReadForbiddenError();
      }
      if (combined.includes('LIHEN_PRODUCT_NOT_FOUND')) {
        throw new ProductNotFoundError(productId);
      }
      throw new Error(`Unable to read product price history through controlled RPC: ${message}`);
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const currency = String(row.currency);
      if (!['COP', 'USD', 'EUR'].includes(currency)) {
        throw new Error(`Price history RPC returned unsupported currency: ${currency}`);
      }

      return new ProductSalePriceChange({
        id: String(row.id),
        productId: String(row.product_id),
        previousPrice: new Money(Number(row.previous_price), currency as Currency),
        newPrice: new Money(Number(row.new_price), currency as Currency),
        reason: String(row.reason),
        actorId: String(row.actor_id),
        changedAt: new Date(String(row.changed_at)),
      });
    });
  }
}
