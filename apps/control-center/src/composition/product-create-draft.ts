import {
  CreateProductHandler,
  createCreateProductCommand,
  createGetProductByIdQuery,
} from '@lihen/products';
import type { DraftOperation, LocalFormDraft } from '../drafts/local-form-draft';
import {
  normalizeProductCreateDraft,
  productCreateReadbackValues,
  provisionalProductIdPattern,
  type ProductCreateDraft,
} from '../drafts/product-create-draft';
import type { ProductsComposition } from './products';

/** Existing application handler/repositories, with a fixed IdGenerator for this creation. */
export function controlledDraftCreateCommand(
  operation: DraftOperation,
  ownerId: string,
  value: ProductCreateDraft,
  price: number,
) {
  return createCreateProductCommand({
    commandId: operation.key,
    operationKey: `product-master:create:${operation.key}`,
    actorId: ownerId,
    requestedAt: new Date(operation.requestedAt),
    ...normalizeProductCreateDraft(value),
    salePrice: price,
  });
}

export function fixedIdentityCreateHandler(
  composition: ProductsComposition,
  provisionalId: string,
) {
  if (!provisionalProductIdPattern.test(provisionalId))
    throw new Error('Invalid provisional product identity.');
  return new CreateProductHandler(
    composition.repository,
    { generate: () => provisionalId },
    composition.brandRepository,
    composition.categoryRepository,
  );
}

export async function confirmCreatedDraft(
  composition: ProductsComposition,
  draft: LocalFormDraft<ProductCreateDraft>,
  provisionalId: string,
  expectedPrice: number,
): Promise<boolean> {
  if (
    !provisionalProductIdPattern.test(provisionalId) ||
    !Number.isFinite(expectedPrice) ||
    expectedPrice < 0
  )
    return false;
  const product = await composition.getProductById.execute(
    createGetProductByIdQuery(provisionalId),
  );
  if (
    !product ||
    product.id !== provisionalId ||
    product.salePrice.currency !== 'COP' ||
    product.salePrice.amount !== expectedPrice
  )
    return false;
  return draft.confirmReadback(productCreateReadbackValues(product));
}
