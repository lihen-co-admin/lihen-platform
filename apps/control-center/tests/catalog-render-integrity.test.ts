import { describe, expect, it } from 'vitest';
import { evaluateCatalogRenderIntegrity } from '../src/read-models/catalog-render-integrity';

describe('GAP-025 catalog render integrity guard', () => {
  it('allows printing only after every required asset is processed successfully', () => {
    const result = evaluateCatalogRenderIntegrity({
      stylePreviewRequested: false,
      expectedImages: 6,
      loadedImages: 6,
      failedImages: 0,
      expectedExtras: 4,
      loadedExtras: 4,
      failedExtras: 0,
    });

    expect(result).toMatchObject({
      status: 'READY',
      canPrint: true,
      processedImages: 6,
      processedExtras: 4,
      failedAssets: 0,
      imagesReady: true,
      extrasReady: true,
      hasFailures: false,
    });
  });

  it('blocks while product images are still pending', () => {
    expect(
      evaluateCatalogRenderIntegrity({
        stylePreviewRequested: false,
        expectedImages: 6,
        loadedImages: 5,
        failedImages: 0,
        expectedExtras: 0,
        loadedExtras: 0,
        failedExtras: 0,
      }),
    ).toMatchObject({
      status: 'BLOCKED_PENDING_ASSETS',
      canPrint: false,
      imagesReady: false,
    });
  });

  it('blocks while institutional extras are still pending', () => {
    expect(
      evaluateCatalogRenderIntegrity({
        stylePreviewRequested: false,
        expectedImages: 1,
        loadedImages: 1,
        failedImages: 0,
        expectedExtras: 3,
        loadedExtras: 2,
        failedExtras: 0,
      }),
    ).toMatchObject({
      status: 'BLOCKED_PENDING_ASSETS',
      canPrint: false,
      extrasReady: false,
    });
  });

  it('blocks when any product image or institutional asset fails', () => {
    const result = evaluateCatalogRenderIntegrity({
      stylePreviewRequested: false,
      expectedImages: 2,
      loadedImages: 1,
      failedImages: 1,
      expectedExtras: 2,
      loadedExtras: 1,
      failedExtras: 1,
    });

    expect(result).toMatchObject({
      status: 'BLOCKED_ASSET_FAILURE',
      canPrint: false,
      failedAssets: 2,
      hasFailures: true,
    });
  });

  it('keeps STYLE DEV preview non-printable even when assets are ready', () => {
    expect(
      evaluateCatalogRenderIntegrity({
        stylePreviewRequested: true,
        expectedImages: 1,
        loadedImages: 1,
        failedImages: 0,
        expectedExtras: 0,
        loadedExtras: 0,
        failedExtras: 0,
      }),
    ).toMatchObject({
      status: 'BLOCKED_STYLE_PREVIEW',
      canPrint: false,
    });
  });

  it('blocks an empty render even when extras require no processing', () => {
    expect(
      evaluateCatalogRenderIntegrity({
        stylePreviewRequested: false,
        expectedImages: 0,
        loadedImages: 0,
        failedImages: 0,
        expectedExtras: 0,
        loadedExtras: 0,
        failedExtras: 0,
      }),
    ).toMatchObject({
      status: 'BLOCKED_EMPTY',
      canPrint: false,
    });
  });

  it('fails closed on invalid counters', () => {
    expect(() =>
      evaluateCatalogRenderIntegrity({
        stylePreviewRequested: false,
        expectedImages: -1,
        loadedImages: 0,
        failedImages: 0,
        expectedExtras: 0,
        loadedExtras: 0,
        failedExtras: 0,
      }),
    ).toThrow('expectedImages must be a non-negative integer.');
  });
});
