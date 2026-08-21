import type { Query } from '@lihen/core';

export interface GetProductSalePriceHistoryPayload {
  readonly productId: string;
}

export type GetProductSalePriceHistoryQuery = Query<GetProductSalePriceHistoryPayload> & {
  readonly type: 'GET_PRODUCT_SALE_PRICE_HISTORY';
};

export function createGetProductSalePriceHistoryQuery(productId: string): GetProductSalePriceHistoryQuery {
  return {
    type: 'GET_PRODUCT_SALE_PRICE_HISTORY',
    queryId: `product-price-history:${productId}`,
    requestedAt: new Date(),
    payload: { productId },
  };
}
