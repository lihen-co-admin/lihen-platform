import type { Command } from '@lihen/core';
import { z } from 'zod';

export const changeProductSalePricePayloadSchema = z.object({
  productId: z.string().trim().min(1),
  newPrice: z.number().finite().nonnegative(),
  reason: z.string().trim().min(3, 'Price change reason is required.'),
});

export type ChangeProductSalePricePayload = z.infer<typeof changeProductSalePricePayloadSchema>;

export type ChangeProductSalePriceCommand = Command<ChangeProductSalePricePayload> & {
  readonly type: 'CHANGE_PRODUCT_SALE_PRICE';
};

export interface ChangeProductSalePriceCommandInput {
  readonly commandId: string;
  readonly actorId: string;
  readonly requestedAt: Date;
  readonly operationKey?: string;
  readonly productId: string;
  readonly newPrice: number;
  readonly reason: string;
}

export function createChangeProductSalePriceCommand(
  input: ChangeProductSalePriceCommandInput,
): ChangeProductSalePriceCommand {
  const payload = changeProductSalePricePayloadSchema.parse({
    productId: input.productId,
    newPrice: input.newPrice,
    reason: input.reason,
  });

  return {
    type: 'CHANGE_PRODUCT_SALE_PRICE',
    commandId: input.commandId,
    actorId: input.actorId,
    requestedAt: input.requestedAt,
    ...(input.operationKey ? { operationKey: input.operationKey } : {}),
    payload,
  };
}
