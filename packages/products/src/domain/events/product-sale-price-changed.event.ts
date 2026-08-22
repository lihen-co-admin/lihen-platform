import type { DomainEvent } from '@lihen/core';

export const PRODUCT_SALE_PRICE_CHANGED_EVENT = 'PRODUCT_SALE_PRICE_CHANGED' as const;

export interface ProductSalePriceChangedPayload {
  readonly previousPrice: number;
  readonly newPrice: number;
  readonly currency: string;
  readonly reason: string;
}

export type ProductSalePriceChangedEvent = DomainEvent<ProductSalePriceChangedPayload> & {
  readonly eventType: typeof PRODUCT_SALE_PRICE_CHANGED_EVENT;
};
