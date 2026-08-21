export interface GetProductsQuery {
  readonly type: 'GetProducts';
}

export function createGetProductsQuery(): GetProductsQuery {
  return { type: 'GetProducts' };
}
