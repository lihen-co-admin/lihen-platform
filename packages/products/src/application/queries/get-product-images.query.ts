export interface GetProductImagesQuery {
  readonly productId: string;
}

export function createGetProductImagesQuery(productId: string): GetProductImagesQuery {
  return { productId };
}
