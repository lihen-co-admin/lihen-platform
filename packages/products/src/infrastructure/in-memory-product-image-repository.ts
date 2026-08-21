import type { ProductImage } from '../domain/product-image';
import { ProductImageNotFoundError } from '../domain/errors/product-errors';
import type { ProductImageRepository } from '../ports/product-image-repository';

export class InMemoryProductImageRepository implements ProductImageRepository {
  private readonly images: ProductImage[];

  public constructor(images: readonly ProductImage[] = []) {
    this.images = [...images];
    this.assertSingleMainPerProduct();
  }

  public async findByProductId(productId: string): Promise<readonly ProductImage[]> {
    return this.images
      .filter((image) => image.productId === productId && image.status === 'ACTIVE')
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public async findById(imageId: string): Promise<ProductImage | null> {
    return this.images.find((image) => image.id === imageId) ?? null;
  }

  public async add(image: ProductImage, _operationKey?: string): Promise<ProductImage> {
    if (image.isMain) {
      for (let index = 0; index < this.images.length; index += 1) {
        const current = this.images[index];
        if (current?.productId === image.productId && current.isMain) {
          this.images[index] = current.withMain(false);
        }
      }
    }

    this.images.push(image);
    this.assertSingleMainPerProduct();
    return image;
  }

  public async setMain(productId: string, imageId: string, _operationKey?: string): Promise<readonly ProductImage[]> {
    const target = this.images.find(
      (image) => image.id === imageId && image.productId === productId && image.status === 'ACTIVE',
    );

    if (!target) throw new ProductImageNotFoundError(imageId);

    for (let index = 0; index < this.images.length; index += 1) {
      const current = this.images[index];
      if (current?.productId === productId) {
        this.images[index] = current.withMain(current.id === imageId);
      }
    }

    this.assertSingleMainPerProduct();
    return this.findByProductId(productId);
  }

  private assertSingleMainPerProduct(): void {
    const count = new Map<string, number>();
    for (const image of this.images) {
      if (!image.isMain || image.status !== 'ACTIVE') continue;
      const next = (count.get(image.productId) ?? 0) + 1;
      if (next > 1) throw new Error(`Product ${image.productId} has more than one main image.`);
      count.set(image.productId, next);
    }
  }
}
