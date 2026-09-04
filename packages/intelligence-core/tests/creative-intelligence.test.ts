import { describe, expect, it } from 'vitest';
import {
  createCreativeIntelligenceHandler,
  generateCreativeCandidates,
  INTELLIGENCE_PERMISSION,
  orchestrateIntelligenceRequest,
} from '../src';
import type {
  ImageGenerationPort,
  PermissionPrincipal,
} from '../src';

const context = {
  contextId: 'ctx-creative-product',
  type: 'PRODUCT' as const,
  entityId: 'product-1',
  businessLine: 'BEAUTY_CARE' as const,
  attributes: {
    creativeBrief: {
      briefId: 'brief-1',
      instruction: 'Create a premium product hero visual.',
      intendedUse: 'catalog-cover',
      sourceAssetRefs: ['asset-original-1'],
      constraints: ['preserve product identity', 'no price text'],
    },
  },
};

const generator: ImageGenerationPort = {
  descriptor: {
    toolId: 'image-generator-test',
    kind: 'GENERATION',
    name: 'Test Image Generator',
    version: '1',
    description: 'Deterministic image generator for tests',
    readOnly: false,
  },
  async generate() {
    return {
      status: 'SUCCESS',
      data: [
        {
          generatedRef: 'generated://creative-1',
          mimeType: 'image/png',
          width: 1080,
          height: 1350,
          provenance: 'GENERATED',
        },
      ],
      messages: ['GENERATION_OK'],
    };
  },
};

const allowedPrincipal: PermissionPrincipal = {
  actorId: 'creative-intelligence',
  actorType: 'INTELLIGENCE',
  grants: [
    {
      permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
      effect: 'ALLOW',
      source: 'test',
    },
    {
      permission: INTELLIGENCE_PERMISSION.GENERATE,
      effect: 'ALLOW',
      source: 'test',
    },
  ],
};

describe('WAVE 11 / GAP-035 Creative Intelligence', () => {
  it('converts generated images into GENERATED evidence and pending candidates', async () => {
    const result = await generateCreativeCandidates(
      { imageGeneration: generator },
      {
        correlationId: 'corr-creative-1',
        requestedBy: 'owner',
        context,
        brief: context.attributes.creativeBrief,
      },
    );

    expect(result.status).toBe('SUCCESS');
    expect(result.evidence).toHaveLength(1);
    expect(result.candidates).toHaveLength(1);
    expect(result.evidence[0]?.sourceAuthority.level).toBe('GENERATED');
    expect(result.evidence[0]?.payload?.provenance).toBe('GENERATED');
    expect(result.candidates[0]?.payload.provenance).toBe('GENERATED');
    expect(result.candidates[0]?.status).toBe('PENDING');
    expect(result.candidates[0]?.type).toBe('PRODUCT_ASSET');
  });

  it('fails closed when no ImageGenerationPort is configured', async () => {
    const result = await generateCreativeCandidates(
      {},
      {
        correlationId: 'corr-no-provider',
        requestedBy: 'owner',
        context,
        brief: context.attributes.creativeBrief,
      },
    );

    expect(result.status).toBe('PROVIDER_NOT_CONFIGURED');
    expect(result.evidence).toEqual([]);
    expect(result.candidates).toEqual([]);
  });

  it('requires GENERATE permission through the existing Orchestrator before calling the provider', async () => {
    let generationCalls = 0;
    const trackingGenerator: ImageGenerationPort = {
      ...generator,
      async generate(request) {
        generationCalls += 1;
        return generator.generate(request);
      },
    };

    const execution = await orchestrateIntelligenceRequest(
      {
        handlers: [
          createCreativeIntelligenceHandler({
            imageGeneration: trackingGenerator,
          }),
        ],
      },
      {
        requestId: 'req-creative-denied',
        correlationId: 'corr-creative-denied',
        requestedBy: 'owner',
        principal: {
          actorId: 'creative-intelligence',
          actorType: 'INTELLIGENCE',
          grants: [
            {
              permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
              effect: 'ALLOW',
              source: 'test',
            },
          ],
        },
        context,
        intent: {
          intentId: 'intent-creative-denied',
          name: 'Generate creative',
          description: 'Generate candidate visual',
          requestedCapabilities: ['CREATIVE_INTELLIGENCE'],
          requiresVerification: false,
          expectedOutput: 'CANDIDATE',
        },
      },
    );

    expect(execution.result.status).toBe('PERMISSION_DENIED');
    expect(generationCalls).toBe(0);
  });

  it('runs inside the existing Orchestrator and returns reviewable candidates only', async () => {
    const execution = await orchestrateIntelligenceRequest(
      {
        handlers: [
          createCreativeIntelligenceHandler({
            imageGeneration: generator,
          }),
        ],
      },
      {
        requestId: 'req-creative',
        correlationId: 'corr-creative',
        requestedBy: 'owner',
        principal: allowedPrincipal,
        context,
        intent: {
          intentId: 'intent-creative',
          name: 'Generate creative',
          description: 'Generate candidate visual',
          requestedCapabilities: ['CREATIVE_INTELLIGENCE'],
          requiresVerification: false,
          expectedOutput: 'CANDIDATE',
        },
      },
    );

    expect(execution.result.status).toBe('SUCCESS');
    expect(execution.executedCapabilities).toEqual(['CREATIVE_INTELLIGENCE']);
    expect(execution.candidates).toHaveLength(1);
    expect(execution.recommendations).toEqual([]);
    expect(execution.candidates[0]?.status).toBe('PENDING');
    expect(execution.evidence[0]?.sourceAuthority.level).toBe('GENERATED');
  });

  it('surfaces provider failures without creating fake evidence or candidates', async () => {
    const failingGenerator: ImageGenerationPort = {
      ...generator,
      async generate() {
        return {
          status: 'FAILED',
          messages: ['GENERATOR_DOWN'],
        };
      },
    };

    const result = await generateCreativeCandidates(
      { imageGeneration: failingGenerator },
      {
        correlationId: 'corr-failed',
        requestedBy: 'owner',
        context,
        brief: context.attributes.creativeBrief,
      },
    );

    expect(result.status).toBe('PROVIDER_FAILED');
    expect(result.evidence).toEqual([]);
    expect(result.candidates).toEqual([]);
    expect(result.messages.join(' ')).toContain('GENERATOR_DOWN');
  });
});
