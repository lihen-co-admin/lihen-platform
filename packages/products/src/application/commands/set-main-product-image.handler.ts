import type { IdGenerator } from '@lihen/core';
import { ProductNotFoundError } from '../../domain/errors/product-errors';
import type { ProductImageRepository } from '../../ports/product-image-repository';
import type { ProductRepository } from '../../ports/product-repository';
import { toProductImageDTO, type ProductImageDTO } from '../dto/product-image.dto';
import type { SetMainProductImageCommand } from './set-main-product-image.command';

export class SetMainProductImageHandler {
  public constructor(
    private readonly products: ProductRepository,
    private readonly images: ProductImageRepository,
    private readonly ids?: IdGenerator,
  ) {}

  public async execute(command: SetMainProductImageCommand): Promise<readonly ProductImageDTO[]> {
    const product = await this.products.findById(command.productId);
    if (!product) throw new ProductNotFoundError(command.productId);

    const operationKey = command.operationKey ?? this.ids?.generate();
    const updated = await this.images.setMain(command.productId, command.imageId, operationKey);
    return updated.map(toProductImageDTO);
  }
}
