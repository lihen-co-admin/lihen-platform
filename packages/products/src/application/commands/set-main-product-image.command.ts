export interface SetMainProductImageCommand {
  readonly productId: string;
  readonly imageId: string;
  readonly operationKey?: string;
}

export function createSetMainProductImageCommand(
  productId: string,
  imageId: string,
  operationKey?: string,
): SetMainProductImageCommand {
  return operationKey ? { productId, imageId, operationKey } : { productId, imageId };
}
