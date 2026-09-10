import { describe, expect, it } from 'vitest';
import {
  removeImageBackground,
} from '../src';
import type {
  ImageTransformationPort,
} from '../src';

const context = {
  contextId: 'ctx-style-product',
  type: 'PRODUCT' as const,
  entityId: 'style-product-1',
  businessLine: 'STYLE' as const,
  attributes: {},
};

const transformer: ImageTransformationPort = {
  descriptor: {
    toolId: 'background-removal-test',
    kind: 'GENERATION',
    name: 'Test Background Removal',
    version: '1',
    description: 'Deterministic constrained transformation for tests',
    readOnly: false,
  },
  async transform(request) {
    return {
      status: 'SUCCESS',
      data: [
        {
          transformedRef: 'transformed://style-product-1',
          sourceAssetRef: request.sourceAssetRef,
          mimeType: 'image/webp',
          width: 1200,
          height: 1600,
          provenance: 'TRANSFORMED',
        },
      ],
      messages: ['BACKGROUND_REMOVAL_OK'],
    };
  },
};

describe('LIHEN Intelligence / constrained image transformation', () => {
  it('creates TRANSFORMED pending candidates without replacing canonical identity', async () => {
    const result = await removeImageBackground(
      { imageTransformation: transformer },
      {
        correlationId: 'corr-transform-1',
        requestedBy: 'owner',
        context,
        brief: {
          briefId: 'brief-transform-1',
          sourceAssetRef: 'asset://canonical-style-1',
          intendedUse: 'CATALOG_PDF',
          constraints: [
            'preserve product identity',
            'remove background only',
          ],
        },
      },
    );

    expect(result.status).toBe('SUCCESS');
    expect(result.evidence).toHaveLength(1);
    expect(result.candidates).toHaveLength(1);

    expect(result.evidence[0]?.payload?.provenance)
      .toBe('TRANSFORMED');

    expect(result.candidates[0]?.payload.provenance)
      .toBe('TRANSFORMED');

    expect(result.candidates[0]?.payload.sourceAssetRef)
      .toBe('asset://canonical-style-1');

    expect(result.candidates[0]?.status)
      .toBe('PENDING');
  });

  it('fails closed when no transformation provider is configured', async () => {
    const result = await removeImageBackground(
      {},
      {
        correlationId: 'corr-no-transform-provider',
        requestedBy: 'owner',
        context,
        brief: {
          briefId: 'brief-no-provider',
          sourceAssetRef: 'asset://canonical-style-1',
          intendedUse: 'CATALOG_PDF',
          constraints: ['preserve product identity'],
        },
      },
    );

    expect(result.status).toBe('PROVIDER_NOT_CONFIGURED');
    expect(result.evidence).toEqual([]);
    expect(result.candidates).toEqual([]);
  });

  it('surfaces provider failure without creating fake transformed assets', async () => {
    const failingTransformer: ImageTransformationPort = {
      ...transformer,
      async transform() {
        return {
          status: 'FAILED',
          messages: ['BACKGROUND_REMOVAL_PROVIDER_DOWN'],
        };
      },
    };

    const result = await removeImageBackground(
      { imageTransformation: failingTransformer },
      {
        correlationId: 'corr-transform-failed',
        requestedBy: 'owner',
        context,
        brief: {
          briefId: 'brief-transform-failed',
          sourceAssetRef: 'asset://canonical-style-1',
          intendedUse: 'CATALOG_PDF',
          constraints: ['preserve product identity'],
        },
      },
    );

    expect(result.status).toBe('PROVIDER_FAILED');
    expect(result.evidence).toEqual([]);
    expect(result.candidates).toEqual([]);
    expect(result.messages.join(' '))
      .toContain('BACKGROUND_REMOVAL_PROVIDER_DOWN');
  });
});
