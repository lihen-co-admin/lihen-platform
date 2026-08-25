import { describe, expect, it } from 'vitest';
import { evaluateProductMediaSourceReadiness } from '../src';

describe('FASE 5 media source readiness', () => {
  it('marks an exact eligible primary source with known dimensions as READY', () => {
    expect(evaluateProductMediaSourceReadiness({
      sourceType: 'HUMAN_PROVIDED',
      isExactProductMatch: true,
      publicationEligibility: 'ELIGIBLE_PRIMARY',
      widthPx: 1200,
      heightPx: 1600,
    })).toBe('READY');
  });

  it('does not approve a source when its dimensions are unknown', () => {
    expect(evaluateProductMediaSourceReadiness({
      sourceType: 'CATALOG_EVIDENCE_CROP',
      isExactProductMatch: true,
      publicationEligibility: 'FALLBACK_ONLY',
    })).toBe('UNKNOWN_DIMENSIONS');
  });

  it('keeps catalog evidence crops as FALLBACK even with known dimensions', () => {
    expect(evaluateProductMediaSourceReadiness({
      sourceType: 'CATALOG_EVIDENCE_CROP',
      isExactProductMatch: true,
      publicationEligibility: 'FALLBACK_ONLY',
      widthPx: 800,
      heightPx: 1000,
    })).toBe('FALLBACK');
  });

  it('requires replacement when product identity is not exact', () => {
    expect(evaluateProductMediaSourceReadiness({
      sourceType: 'OFFICIAL_WEB',
      isExactProductMatch: false,
      publicationEligibility: 'ELIGIBLE_PRIMARY',
      widthPx: 1200,
      heightPx: 1200,
    })).toBe('REPLACE');
  });

  it('requires replacement when publication is not eligible', () => {
    expect(evaluateProductMediaSourceReadiness({
      sourceType: 'VERIFIED_EXTERNAL',
      isExactProductMatch: true,
      publicationEligibility: 'NOT_ELIGIBLE',
      widthPx: 1200,
      heightPx: 1200,
    })).toBe('REPLACE');
  });
});
