import { describe, expect, it } from 'vitest';
import { INVENTORY_BUCKETS } from '../src';

describe('inventory model', () => {
  it('matches the canonical immutable ledger buckets', () => {
    expect(INVENTORY_BUCKETS).toEqual(['ON_HAND', 'RESERVED', 'PENDING_IN']);
  });
});
