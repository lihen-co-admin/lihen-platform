export interface AddProductImageCommand {
  readonly productId: string;
  readonly publicUrl: string;
  readonly altText?: string;
  readonly makeMain?: boolean;
  readonly operationKey?: string;
}

export function createAddProductImageCommand(
  input: AddProductImageCommand,
): AddProductImageCommand {
  return input;
}
