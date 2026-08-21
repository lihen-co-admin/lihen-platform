export interface GetProductByIdQuery {
  readonly type: 'GET_PRODUCT_BY_ID';
  readonly productId: string;
}

export function createGetProductByIdQuery(productId: string): GetProductByIdQuery {
  const normalizedId = productId.trim();

  if (!normalizedId) {
    throw new Error('Product id is required.');
  }

  return {
    type: 'GET_PRODUCT_BY_ID',
    productId: normalizedId,
  };
}
