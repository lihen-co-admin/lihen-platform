import type { IdGenerator } from '@lihen/core';
import { ProductImage } from '../../domain/product-image';
import { ProductNotFoundError } from '../../domain/errors/product-errors';
import type { ProductImageRepository } from '../../ports/product-image-repository';
import type { ProductRepository } from '../../ports/product-repository';
import { toProductImageDTO, type ProductImageDTO } from '../dto/product-image.dto';
import type { AddProductImageCommand } from './add-product-image.command';

export class AddProductImageHandler {
  public constructor(
    private readonly products: ProductRepository,
    private readonly images: ProductImageRepository,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(command: AddProductImageCommand): Promise<ProductImageDTO> {
    const product = await this.products.findById(command.productId);
    if (!product) throw new ProductNotFoundError(command.productId);

    const existing = await this.images.findByProductId(command.productId);
    const shouldBeMain = command.makeMain ?? existing.length === 0;
    const nextSortOrder = existing.length === 0
      ? 0
      : Math.max(...existing.map((image) => image.sortOrder)) + 1;

    const image = new ProductImage({
      id: this.ids.generate(),
      productId: command.productId,
      publicUrl: command.publicUrl,
      ...(command.altText?.trim() ? { altText: command.altText.trim() } : {}),
      isMain: shouldBeMain,
      sortOrder: nextSortOrder,
      sourceType: 'MANUAL',
    });

    const operationKey = command.operationKey ?? this.ids.generate();
    return toProductImageDTO(await this.images.add(image, operationKey));
  }
}
