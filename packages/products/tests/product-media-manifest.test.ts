import { describe, expect, it } from 'vitest';
import {
  buildProductMediaManifest,
  selectProductMediaSource,
} from '../src';

describe('FASE 5 product media manifest', () => {
  it('builds a dry-run manifest without generating media', () => {
    const selection = selectProductMediaSource('WEB_DETAIL', [
      {
        sourceId: 'human-source',
        sourceType: 'HUMAN_PROVIDED',
        isExactProductMatch: true,
        publicationEligibility: 'ELIGIBLE_PRIMARY',
        widthPx: 1200,
        heightPx: 1600,
      },
    ]);

    const manifest = buildProductMediaManifest('product-1', [selection]);

    expect(manifest.dryRun).toBe(true);
    expect(manifest.entries).toEqual([
      {
        surface: 'WEB_DETAIL',
        status: 'READY',
        selectionStatus: 'SELECTED_READY',
        sourceId: 'human-source',
        readiness: 'READY',
        noUpscale: true,
      },
    ]);
  });

  it('keeps fallback explicit in the manifest', () => {
    const selection = selectProductMediaSource('CATALOG_PDF', [
      {
        sourceId: 'catalog-source',
        sourceType: 'CATALOG_EVIDENCE_CROP',
        isExactProductMatch: true,
        publicationEligibility: 'FALLBACK_ONLY',
        widthPx: 800,
        heightPx: 1000,
      },
    ]);

    const manifest = buildProductMediaManifest('product-1', [selection]);

    expect(manifest.entries[0]).toMatchObject({
      surface: 'CATALOG_PDF',
      status: 'FALLBACK',
      selectionStatus: 'SELECTED_FALLBACK',
      sourceId: 'catalog-source',
      noUpscale: true,
    });
  });

  it('blocks generation when source dimensions are unknown', () => {
    const selection = selectProductMediaSource('WEB_DETAIL', [
      {
        sourceId: 'catalog-source',
        sourceType: 'CATALOG_EVIDENCE_CROP',
        isExactProductMatch: true,
        publicationEligibility: 'FALLBACK_ONLY',
      },
    ]);

    const manifest = buildProductMediaManifest('product-1', [selection]);

    expect(manifest.entries[0]).toEqual({
      surface: 'WEB_DETAIL',
      status: 'BLOCKED_UNKNOWN_DIMENSIONS',
      selectionStatus: 'UNKNOWN_DIMENSIONS_ONLY',
      noUpscale: true,
    });
  });

  it('blocks generation when no usable source exists', () => {
    const selection = selectProductMediaSource('WEB_CARD', [
      {
        sourceId: 'wrong-product',
        sourceType: 'OFFICIAL_WEB',
        isExactProductMatch: false,
        publicationEligibility: 'ELIGIBLE_PRIMARY',
        widthPx: 1200,
        heightPx: 1200,
      },
    ]);

    const manifest = buildProductMediaManifest('product-1', [selection]);

    expect(manifest.entries[0]).toEqual({
      surface: 'WEB_CARD',
      status: 'BLOCKED_NO_USABLE_SOURCE',
      selectionStatus: 'NO_USABLE_SOURCE',
      noUpscale: true,
    });
  });

  it('requires a product id', () => {
    expect(() => buildProductMediaManifest('   ', [])).toThrow(
      /productId is required/i,
    );
  });
});
