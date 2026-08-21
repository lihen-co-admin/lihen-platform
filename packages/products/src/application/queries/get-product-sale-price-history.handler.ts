import type { ProductPricingRepository } from '../../ports/product-pricing-repository';
import type { ProductSalePriceChangeDTO } from '../dto/product-sale-price-change.dto';
import type { GetProductSalePriceHistoryQuery } from './get-product-sale-price-history.query';

export class GetProductSalePriceHistoryHandler {
  public constructor(private readonly pricing: ProductPricingRepository) {}

  public async execute(
    query: GetProductSalePriceHistoryQuery,
  ): Promise<readonly ProductSalePriceChangeDTO[]> {
    const history = await this.pricing.findSalePriceHistoryByProductId(query.payload.productId);

    return history.map((entry) => ({
      id: entry.id,
      productId: entry.productId,
      previousPrice: {
        amount: entry.previousPrice.amount,
        currency: entry.previousPrice.currency,
      },
      newPrice: {
        amount: entry.newPrice.amount,
        currency: entry.newPrice.currency,
      },
      reason: entry.reason,
      actorId: entry.actorId,
      changedAt: entry.changedAt.toISOString(),
    }));
  }
}
