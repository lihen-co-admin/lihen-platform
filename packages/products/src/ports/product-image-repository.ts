import type { ProductImage } from '../domain/product-image';

export interface ProductImageRepository {
  findByProductId(productId: string): Promise<readonly ProductImage[]>;
  findById(imageId: string): Promise<ProductImage | null>;
  add(image: ProductImage, operationKey?: string): Promise<ProductImage>;
  setMain(productId: string, imageId: string, operationKey?: string): Promise<readonly ProductImage[]>;
}
