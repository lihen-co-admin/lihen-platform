import type { SupabaseClient } from '@supabase/supabase-js';
import { ProductImage } from '../domain/product-image';
import type {
  ProductImageAssetRole,
  ProductImageDerivativeProfile,
  ProductImageSourceType,
  ProductImageStatus,
} from '../domain/product-image';
import {
  ProductImageIdConflictError,
  ProductImageNotFoundError,
  ProductImageWriteBlockedError,
  ProductImageWriteForbiddenError,
  ProductImageWriteOperationConflictError,
  ProductImagesReadForbiddenError,
  ProductImagesUnavailableError,
  ProductNotFoundError,
} from '../domain/errors/product-errors';
import type { ProductImageRepository } from '../ports/product-image-repository';

export interface SupabaseProductImageRepositoryOptions {
  readonly readEnabled?: boolean;
  readonly controlledWriteEnabled?: boolean;
}

function mapProductImageRow(row: Record<string, unknown>): ProductImage {
  return new ProductImage({
    id: String(row.id),
    productId: String(row.product_id),
    publicUrl: String(row.public_url),
    ...(row.alt_text ? { altText: String(row.alt_text) } : {}),
    isMain: Boolean(row.is_main),
    sortOrder: Number(row.sort_order),
    sourceType: String(row.source_type) as ProductImageSourceType,
    status: String(row.status) as ProductImageStatus,
    ...(row.source_id ? { sourceId: String(row.source_id) } : {}),
    ...(row.asset_role ? { assetRole: String(row.asset_role) as ProductImageAssetRole } : {}),
    ...(row.derivative_profile
      ? { derivativeProfile: String(row.derivative_profile) as ProductImageDerivativeProfile }
      : {}),
  });
}

function combinedError(error: { message?: string; details?: string }): string {
  return `${error.message ?? ''} ${error.details ?? ''}`;
}

export class SupabaseProductImageRepository implements ProductImageRepository {
  private readonly readEnabled: boolean;
  private readonly controlledWriteEnabled: boolean;

  public constructor(
    private readonly client: SupabaseClient,
    options: SupabaseProductImageRepositoryOptions = {},
  ) {
    this.readEnabled = options.readEnabled ?? false;
    this.controlledWriteEnabled = options.controlledWriteEnabled ?? false;
  }

  public async findByProductId(productId: string): Promise<readonly ProductImage[]> {
    if (!this.readEnabled) throw new ProductImagesUnavailableError();

    const { data, error } = await this.client.rpc('get_product_images', {
      p_product_id: productId,
    });

    if (error) {
      const combined = combinedError(error);
      if (combined.includes('permission denied for function get_product_images')) {
        throw new ProductImagesUnavailableError();
      }
      if (
        combined.includes('LIHEN_PRODUCT_IMAGES_READ_FORBIDDEN')
        || combined.includes('LIHEN_AUTH_REQUIRED')
      ) {
        throw new ProductImagesReadForbiddenError();
      }
      if (combined.includes('LIHEN_PRODUCT_NOT_FOUND')) {
        throw new ProductNotFoundError(productId);
      }
      throw new Error(`Unable to read product images through controlled RPC: ${error.message}`);
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map(mapProductImageRow);
  }

  public async findById(imageId: string): Promise<ProductImage | null> {
    if (!this.readEnabled) throw new ProductImagesUnavailableError();
    throw new ProductImageNotFoundError(imageId);
  }

  public async add(image: ProductImage, operationKey?: string): Promise<ProductImage> {
    if (!this.controlledWriteEnabled) throw new ProductImageWriteBlockedError();
    if (!operationKey?.trim()) {
      throw new Error('Product image controlled write requires an operation key.');
    }

    const { data, error } = await this.client.rpc('add_product_image_controlled', {
      p_operation_key: operationKey,
      p_image_id: image.id,
      p_product_id: image.productId,
      p_public_url: image.publicUrl,
      p_alt_text: image.altText ?? null,
      p_make_main: image.isMain,
    });

    if (error) {
      const combined = combinedError(error);
      if (combined.includes('permission denied for function add_product_image_controlled')) {
        throw new ProductImageWriteBlockedError();
      }
      if (
        combined.includes('LIHEN_PRODUCT_IMAGE_WRITE_FORBIDDEN')
        || combined.includes('LIHEN_AUTH_REQUIRED')
      ) {
        throw new ProductImageWriteForbiddenError();
      }
      if (combined.includes('LIHEN_PRODUCT_IMAGE_WRITE_OPERATION_CONFLICT')) {
        throw new ProductImageWriteOperationConflictError(operationKey);
      }
      if (combined.includes('LIHEN_PRODUCT_IMAGE_ID_CONFLICT')) {
        throw new ProductImageIdConflictError(image.id);
      }
      if (combined.includes('LIHEN_PRODUCT_NOT_FOUND')) {
        throw new ProductNotFoundError(image.productId);
      }
      throw new Error(`Unable to add product image through controlled RPC: ${error.message}`);
    }

    const row = ((data ?? []) as Array<Record<string, unknown>>)[0];
    if (!row) throw new Error('Controlled AddProductImage RPC returned no row.');
    return mapProductImageRow(row);
  }

  public async setMain(
    productId: string,
    imageId: string,
    operationKey?: string,
  ): Promise<readonly ProductImage[]> {
    if (!this.controlledWriteEnabled) throw new ProductImageWriteBlockedError();
    if (!operationKey?.trim()) {
      throw new Error('SetMainProductImage controlled write requires an operation key.');
    }

    const { data, error } = await this.client.rpc('set_main_product_image_controlled', {
      p_operation_key: operationKey,
      p_product_id: productId,
      p_image_id: imageId,
    });

    if (error) {
      const combined = combinedError(error);
      if (combined.includes('permission denied for function set_main_product_image_controlled')) {
        throw new ProductImageWriteBlockedError();
      }
      if (
        combined.includes('LIHEN_PRODUCT_IMAGE_WRITE_FORBIDDEN')
        || combined.includes('LIHEN_AUTH_REQUIRED')
      ) {
        throw new ProductImageWriteForbiddenError();
      }
      if (combined.includes('LIHEN_PRODUCT_IMAGE_WRITE_OPERATION_CONFLICT')) {
        throw new ProductImageWriteOperationConflictError(operationKey);
      }
      if (combined.includes('LIHEN_PRODUCT_IMAGE_NOT_FOUND')) {
        throw new ProductImageNotFoundError(imageId);
      }
      if (combined.includes('LIHEN_PRODUCT_NOT_FOUND')) {
        throw new ProductNotFoundError(productId);
      }
      throw new Error(`Unable to set main product image through controlled RPC: ${error.message}`);
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map(mapProductImageRow);
  }
}
