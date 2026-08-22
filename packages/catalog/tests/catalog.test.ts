import { describe, expect, it } from 'vitest';
import { CATALOG_SOURCE_TYPES, CATALOG_VERSION_STATUSES } from '../src';

describe('catalog version model', () => {
  it('separates source type from publication status', () => {
    expect(CATALOG_SOURCE_TYPES).toEqual(['PDF', 'WEB']);
    expect(CATALOG_VERSION_STATUSES).toEqual(['DRAFT', 'ACTIVE', 'ARCHIVED']);
  });
});
