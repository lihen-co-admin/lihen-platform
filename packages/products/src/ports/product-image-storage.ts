import type { ProductImageStorageCandidate } from '../domain/product-image-storage';

export interface StoredProductImageObject {
  readonly bucket: string;
  readonly path: string;
  readonly publicUrl?: string;
}

export interface ProductImageStorageUpload extends ProductImageStorageCandidate {
  readonly body: Blob | ArrayBuffer | Uint8Array;
}

export interface ProductImageStorage {
  uploadOriginal(input: ProductImageStorageUpload): Promise<StoredProductImageObject>;
  uploadWebDerivative(input: ProductImageStorageUpload): Promise<StoredProductImageObject>;
}
