import { describe, expect, it } from 'vitest';
import {
  PROVIDER_CAPABILITY_MATRIX,
  getProviderCapabilityBinding,
} from '../src';
import type {
  IntelligenceCapabilityName,
  IntelligenceProviderPortName,
} from '../src';

const allCapabilities = [
  'VISION',
  'SEARCH',
  'VERIFICATION',
  'PRODUCT_INTELLIGENCE',
  'BRAND_INTELLIGENCE',
  'CATALOG_INTELLIGENCE',
  'DOCUMENT_INTELLIGENCE',
  'REPORT_GENERATION',
  'CREATIVE_INTELLIGENCE',
  'IMAGE_TRANSFORMATION',
  'CUSTOMER_INTELLIGENCE',
  'MARKETING_INTELLIGENCE',
  'CONVERSATION_INTELLIGENCE',
  'ANALYTICS',
  'AUTOMATION',
  'AUDIT_INTELLIGENCE',
  'ASSISTANT',
] as const satisfies readonly IntelligenceCapabilityName[];

describe('LIHEN Provider Capability Matrix', () => {
  it('is exhaustive for every Intelligence capability', () => {
    expect(Object.keys(PROVIDER_CAPABILITY_MATRIX).sort())
      .toEqual([...allCapabilities].sort());

    expect(Object.keys(PROVIDER_CAPABILITY_MATRIX))
      .toHaveLength(17);
  });

  it('records only existing provider-neutral Intelligence ports', () => {
    const allowedPorts = new Set<IntelligenceProviderPortName>([
      'ModelPort',
      'VisionPort',
      'SearchPort',
      'DocumentExtractionPort',
      'ImageGenerationPort',
      'ImageTransformationPort',
      'ReportGenerationPort',
      'EmbeddingPort',
    ]);

    for (const binding of Object.values(PROVIDER_CAPABILITY_MATRIX)) {
      for (const port of [
        ...binding.requiredPorts,
        ...binding.optionalPorts,
      ]) {
        expect(allowedPorts.has(port)).toBe(true);
      }
    }
  });

  it('preserves the currently required Brand Intelligence provider boundary', () => {
    expect(
      getProviderCapabilityBinding('BRAND_INTELLIGENCE'),
    ).toEqual({
      implementation: 'IMPLEMENTED',
      requiredPorts: ['SearchPort', 'VisionPort'],
      optionalPorts: [],
    });
  });

  it('preserves required extraction and optional enrichment for Document Intelligence', () => {
    expect(
      getProviderCapabilityBinding('DOCUMENT_INTELLIGENCE'),
    ).toEqual({
      implementation: 'IMPLEMENTED',
      requiredPorts: ['DocumentExtractionPort'],
      optionalPorts: ['VisionPort', 'SearchPort'],
    });
  });

  it('keeps generation and Assistant providers optional where code fails closed without them', () => {
    expect(
      getProviderCapabilityBinding('CREATIVE_INTELLIGENCE').optionalPorts,
    ).toEqual(['ImageGenerationPort']);

    expect(
      getProviderCapabilityBinding('IMAGE_TRANSFORMATION').optionalPorts,
    ).toEqual(['ImageTransformationPort']);

    expect(
      getProviderCapabilityBinding('REPORT_GENERATION').optionalPorts,
    ).toEqual(['ReportGenerationPort']);

    expect(
      getProviderCapabilityBinding('ASSISTANT').optionalPorts,
    ).toEqual(['ModelPort']);
  });

  it('does not pretend abstract capabilities already have production provider bindings', () => {
    for (const capability of [
      'VISION',
      'SEARCH',
      'VERIFICATION',
      'CATALOG_INTELLIGENCE',
    ] as const) {
      expect(
        getProviderCapabilityBinding(capability),
      ).toEqual({
        implementation: 'ABSTRACT_ONLY',
        requiredPorts: [],
        optionalPorts: [],
      });
    }
  });

  it('keeps deterministic/current internal capabilities provider-free', () => {
    for (const capability of [
      'PRODUCT_INTELLIGENCE',
      'CUSTOMER_INTELLIGENCE',
      'MARKETING_INTELLIGENCE',
      'CONVERSATION_INTELLIGENCE',
      'ANALYTICS',
      'AUTOMATION',
      'AUDIT_INTELLIGENCE',
    ] as const) {
      const binding = getProviderCapabilityBinding(capability);

      expect(binding.implementation).toBe('IMPLEMENTED');
      expect(binding.requiredPorts).toEqual([]);
      expect(binding.optionalPorts).toEqual([]);
    }
  });

  it('does not expose governed outbound Messaging/Social ports as Intelligence providers', () => {
    const serialized = JSON.stringify(PROVIDER_CAPABILITY_MATRIX);

    expect(serialized).not.toContain('MessagingPort');
    expect(serialized).not.toContain('SocialPublishingPort');
  });
});
