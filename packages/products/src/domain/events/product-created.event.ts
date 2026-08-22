import type { DomainEvent } from '@lihen/core';

export const PRODUCT_CREATED_EVENT = 'PRODUCT_CREATED' as const;

export interface ProductCreatedPayload {
  readonly sku: string | null;
  readonly catalogCode: string | null;
  readonly name: string;
  readonly businessLine: string;
}

export type ProductCreatedEvent = DomainEvent<ProductCreatedPayload> & {
  readonly eventType: typeof PRODUCT_CREATED_EVENT;
};
