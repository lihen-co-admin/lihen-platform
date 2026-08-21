import { describe, expect, it } from 'vitest';
import { Money } from '@lihen/shared';
import { Product } from '../src/domain/product';

describe('Product', () => {
  it('requires a non-empty name', () => {
    expect(
      () =>
        new Product({ businessLine:'BEAUTY_CARE',
          id: 'p-1',
          name: '   ',
          status: 'ACTIVE',
          salePrice: new Money(10_000),
        }),
    ).toThrow();
  });
});
