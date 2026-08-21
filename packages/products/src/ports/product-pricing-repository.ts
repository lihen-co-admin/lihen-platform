import type { Product } from '../domain/product';
import type { ProductSalePriceChange } from '../domain/product-sale-price-change';

export interface ProductPriceWriteContext {
  readonly operationKey: string;
}

export interface ProductSalePriceWriteResult {
  readonly product: Product;
  readonly historyEntry: ProductSalePriceChange;
}

export interface ProductPricingRepository {
  changeSalePrice(
    product: Product,
    historyEntry: ProductSalePriceChange,
    context?: ProductPriceWriteContext,
  ): Promise<ProductSalePriceWriteResult>;
  findSalePriceHistoryByProductId(productId: string): Promise<readonly ProductSalePriceChange[]>;
}
