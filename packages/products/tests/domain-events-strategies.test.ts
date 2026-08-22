import { describe, expect, it } from 'vitest';
import {
  PRODUCT_CREATED_EVENT,
  conservativeProductImportDecisionStrategy,
  type ProductCreatedEvent,
} from '../src/index';

describe('product domain events and strategies', () => {
  it('keeps the product created event contract explicit', () => {
    const event: ProductCreatedEvent = {
      eventId: 'event-1',
      eventType: PRODUCT_CREATED_EVENT,
      aggregateId: 'product-1',
      occurredAt: new Date('2026-08-22T04:30:00.000Z'),
      payload: {
        sku: 'BC-TEST',
        catalogCode: null,
        name: 'Producto',
        businessLine: 'BEAUTY_CARE',
      },
    };
    expect(event.eventType).toBe('PRODUCT_CREATED');
  });

  it('sends ambiguous import identities to review rather than inventing a match', () => {
    expect(
      conservativeProductImportDecisionStrategy.decide({
        hasStableIdentity: false,
        hasBusinessLine: true,
        hasConflictingEvidence: false,
      }),
    ).toBe('REVIEW');
  });
});
