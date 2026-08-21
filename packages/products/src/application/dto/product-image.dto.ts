import type { ProductImage } from '../../domain/product-image';

export interface ProductImageDTO {
  readonly id: string;
  readonly productId: string;
  readonly publicUrl: string;
  readonly altText?: string;
  readonly isMain: boolean;
  readonly sortOrder: number;
  readonly sourceType: ProductImage['sourceType'];
}

export function toProductImageDTO(image: ProductImage): ProductImageDTO {
  return {
    id: image.id,
    productId: image.productId,
    publicUrl: image.publicUrl,
    ...(image.altText ? { altText: image.altText } : {}),
    isMain: image.isMain,
    sortOrder: image.sortOrder,
    sourceType: image.sourceType,
  };
}
