import type { ProductImageRepository } from '../../ports/product-image-repository';
import { toProductImageDTO, type ProductImageDTO } from '../dto/product-image.dto';
import type { GetProductImagesQuery } from './get-product-images.query';

export class GetProductImagesHandler {
  public constructor(private readonly images: ProductImageRepository) {}

  public async execute(query: GetProductImagesQuery): Promise<readonly ProductImageDTO[]> {
    return (await this.images.findByProductId(query.productId)).map(toProductImageDTO);
  }
}
