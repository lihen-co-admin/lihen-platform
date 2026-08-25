import { describe, expect, it } from 'vitest';
import { auditBrandLogos } from '../src/components/brand-logo-audit';

describe('QA-B brand logo audit', () => {
  it('distinguishes canonical, bundled fallback and missing verified source', () => {
    const result = auditBrandLogos([
      { brand_id: '1', brand_name: 'Canonical', logo_url: 'https://example.test/logo.webp', visible_product_count: 2 },
      { brand_id: '2', brand_name: 'Bloomshell', logo_url: null, visible_product_count: 4 },
      { brand_id: '3', brand_name: 'Unknown Brand', logo_url: null, visible_product_count: 1 },
    ]);
    expect(result.map((item) => item.readiness)).toEqual(['CANONICAL', 'BUNDLED_FALLBACK', 'MISSING_VERIFIED_SOURCE']);
  });
});
