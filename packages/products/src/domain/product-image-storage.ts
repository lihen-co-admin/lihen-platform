export const PRODUCT_IMAGE_ORIGINALS_BUCKET = 'lihen-product-originals' as const;
export const PRODUCT_IMAGE_WEB_BUCKET = 'lihen-product-web' as const;

export const PRODUCT_IMAGE_ORIGINAL_MAX_BYTES = 12 * 1024 * 1024;
export const PRODUCT_IMAGE_WEB_MAX_BYTES = 3 * 1024 * 1024;

export const PRODUCT_IMAGE_ALLOWED_ORIGINAL_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const PRODUCT_IMAGE_ALLOWED_WEB_MIME_TYPES = [
  'image/webp',
  'image/jpeg',
  'image/png',
] as const;

export type ProductImageOriginalMimeType = (typeof PRODUCT_IMAGE_ALLOWED_ORIGINAL_MIME_TYPES)[number];
export type ProductImageWebMimeType = (typeof PRODUCT_IMAGE_ALLOWED_WEB_MIME_TYPES)[number];
export type ProductImageStorageVariant = 'ORIGINAL' | 'WEB';

export interface ProductImageStorageCandidate {
  readonly productId: string;
  readonly imageId: string;
  readonly sha256: string;
  readonly mimeType: ProductImageOriginalMimeType | ProductImageWebMimeType;
  readonly byteSize: number;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/i;

function assertUuid(value: string, field: string): string {
  const normalized = value.trim().toLowerCase();
  if (!uuidPattern.test(normalized)) throw new Error(`${field} must be a UUID.`);
  return normalized;
}

function assertSha256(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!sha256Pattern.test(normalized)) throw new Error('Image sha256 must contain exactly 64 hexadecimal characters.');
  return normalized;
}

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    default: throw new Error(`Unsupported product image MIME type: ${mimeType}`);
  }
}

export function validateOriginalImageCandidate(candidate: ProductImageStorageCandidate): void {
  assertUuid(candidate.productId, 'productId');
  assertUuid(candidate.imageId, 'imageId');
  assertSha256(candidate.sha256);
  if (!PRODUCT_IMAGE_ALLOWED_ORIGINAL_MIME_TYPES.includes(candidate.mimeType as ProductImageOriginalMimeType)) {
    throw new Error(`Original product image MIME type is not allowed: ${candidate.mimeType}`);
  }
  if (!Number.isInteger(candidate.byteSize) || candidate.byteSize <= 0) {
    throw new Error('Original product image byteSize must be a positive integer.');
  }
  if (candidate.byteSize > PRODUCT_IMAGE_ORIGINAL_MAX_BYTES) {
    throw new Error(`Original product image exceeds ${PRODUCT_IMAGE_ORIGINAL_MAX_BYTES} bytes.`);
  }
}

export function validateWebImageCandidate(candidate: ProductImageStorageCandidate): void {
  assertUuid(candidate.productId, 'productId');
  assertUuid(candidate.imageId, 'imageId');
  assertSha256(candidate.sha256);
  if (!PRODUCT_IMAGE_ALLOWED_WEB_MIME_TYPES.includes(candidate.mimeType as ProductImageWebMimeType)) {
    throw new Error(`Web product image MIME type is not allowed: ${candidate.mimeType}`);
  }
  if (!Number.isInteger(candidate.byteSize) || candidate.byteSize <= 0) {
    throw new Error('Web product image byteSize must be a positive integer.');
  }
  if (candidate.byteSize > PRODUCT_IMAGE_WEB_MAX_BYTES) {
    throw new Error(`Web product image exceeds ${PRODUCT_IMAGE_WEB_MAX_BYTES} bytes.`);
  }
}

export function buildOriginalProductImagePath(candidate: ProductImageStorageCandidate): string {
  validateOriginalImageCandidate(candidate);
  const productId = candidate.productId.trim().toLowerCase();
  const imageId = candidate.imageId.trim().toLowerCase();
  const sha256 = candidate.sha256.trim().toLowerCase();
  return `products/${productId}/${imageId}/original/${sha256}.${extensionForMime(candidate.mimeType)}`;
}

export function buildWebProductImagePath(candidate: ProductImageStorageCandidate): string {
  validateWebImageCandidate(candidate);
  const productId = candidate.productId.trim().toLowerCase();
  const imageId = candidate.imageId.trim().toLowerCase();
  const sha256 = candidate.sha256.trim().toLowerCase();
  return `products/${productId}/${imageId}/web/${sha256}.${extensionForMime(candidate.mimeType)}`;
}
