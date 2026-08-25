import { describe, expect, it } from 'vitest';
import { selectProductMediaSource } from '../src';

describe('FASE 5 media source selection', () => {
  it('prefers a READY primary source over fallback evidence', () => {
    const result = selectProductMediaSource('WEB_DETAIL', [
      {
        sourceId: 'catalog-source',
        sourceType: 'CATALOG_EVIDENCE_CROP',
        isExactProductMatch: true,
        publicationEligibility: 'FALLBACK_ONLY',
        widthPx: 800,
        heightPx: 1000,
      },
      {
        sourceId: 'human-source',
        sourceType: 'HUMAN_PROVIDED',
        isExactProductMatch: true,
        publicationEligibility: 'ELIGIBLE_PRIMARY',
        widthPx: 1200,
        heightPx: 1600,
      },
    ]);

    expect(result.status).toBe('SELECTED_READY');
    expect(result.source?.sourceId).toBe('human-source');
  });

  it('uses fallback only when no READY source exists', () => {
    const result = selectProductMediaSource('CATALOG_PDF', [
      {
        sourceId: 'catalog-source',
        sourceType: 'CATALOG_EVIDENCE_CROP',
        isExactProductMatch: true,
        publicationEligibility: 'FALLBACK_ONLY',
        widthPx: 800,
        heightPx: 1000,
      },
    ]);

    expect(result.status).toBe('SELECTED_FALLBACK');
    expect(result.source?.sourceId).toBe('catalog-source');
  });

  it('does not select sources whose dimensions are unknown', () => {
    const result = selectProductMediaSource('WEB_DETAIL', [
      {
        sourceId: 'catalog-source',
        sourceType: 'CATALOG_EVIDENCE_CROP',
        isExactProductMatch: true,
        publicationEligibility: 'FALLBACK_ONLY',
      },
    ]);

    expect(result.status).toBe('UNKNOWN_DIMENSIONS_ONLY');
    expect(result.source).toBeUndefined();
  });

  it('does not select sources that require replacement', () => {
    const result = selectProductMediaSource('WEB_CARD', [
      {
        sourceId: 'wrong-product',
        sourceType: 'OFFICIAL_WEB',
        isExactProductMatch: false,
        publicationEligibility: 'ELIGIBLE_PRIMARY',
        widthPx: 1200,
        heightPx: 1200,
      },
    ]);

    expect(result.status).toBe('NO_USABLE_SOURCE');
    expect(result.source).toBeUndefined();
  });

  it('prefers HUMAN_PROVIDED when equally READY sources exist', () => {
    const result = selectProductMediaSource('WEB_DETAIL', [
      {
        sourceId: 'official-source',
        sourceType: 'OFFICIAL_WEB',
        isExactProductMatch: true,
        publicationEligibility: 'ELIGIBLE_PRIMARY',
        widthPx: 1400,
        heightPx: 1400,
      },
      {
        sourceId: 'human-source',
        sourceType: 'HUMAN_PROVIDED',
        isExactProductMatch: true,
        publicationEligibility: 'ELIGIBLE_PRIMARY',
        widthPx: 1200,
        heightPx: 1600,
      },
    ]);

    expect(result.status).toBe('SELECTED_READY');
    expect(result.source?.sourceId).toBe('human-source');
  });
});
