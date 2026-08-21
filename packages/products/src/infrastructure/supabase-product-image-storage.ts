import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PRODUCT_IMAGE_ORIGINALS_BUCKET,
  PRODUCT_IMAGE_WEB_BUCKET,
  buildOriginalProductImagePath,
  buildWebProductImagePath,
} from '../domain/product-image-storage';
import { ProductImageStorageWriteBlockedError } from '../domain/errors/product-errors';
import type {
  ProductImageStorage,
  ProductImageStorageUpload,
  StoredProductImageObject,
} from '../ports/product-image-storage';

export interface SupabaseProductImageStorageOptions {
  readonly originalUploadEnabled?: boolean;
  readonly webDerivativeUploadEnabled?: boolean;
}

export class SupabaseProductImageStorage implements ProductImageStorage {
  private readonly originalUploadEnabled: boolean;
  private readonly webDerivativeUploadEnabled: boolean;

  public constructor(
    private readonly client: SupabaseClient,
    options: SupabaseProductImageStorageOptions = {},
  ) {
    this.originalUploadEnabled = options.originalUploadEnabled ?? false;
    this.webDerivativeUploadEnabled = options.webDerivativeUploadEnabled ?? false;
  }

  public async uploadOriginal(input: ProductImageStorageUpload): Promise<StoredProductImageObject> {
    if (!this.originalUploadEnabled) throw new ProductImageStorageWriteBlockedError();

    const path = buildOriginalProductImagePath(input);
    const { error } = await this.client.storage
      .from(PRODUCT_IMAGE_ORIGINALS_BUCKET)
      .upload(path, input.body, {
        contentType: input.mimeType,
        upsert: false,
      });

    if (error) throw new Error(`Unable to upload original product image: ${error.message}`);
    return { bucket: PRODUCT_IMAGE_ORIGINALS_BUCKET, path };
  }

  public async uploadWebDerivative(input: ProductImageStorageUpload): Promise<StoredProductImageObject> {
    if (!this.webDerivativeUploadEnabled) throw new ProductImageStorageWriteBlockedError();

    const path = buildWebProductImagePath(input);
    const bucket = this.client.storage.from(PRODUCT_IMAGE_WEB_BUCKET);
    const { error } = await bucket.upload(path, input.body, {
      contentType: input.mimeType,
      upsert: false,
    });

    if (error) throw new Error(`Unable to upload web product image derivative: ${error.message}`);
    const { data } = bucket.getPublicUrl(path);
    return { bucket: PRODUCT_IMAGE_WEB_BUCKET, path, publicUrl: data.publicUrl };
  }
}
