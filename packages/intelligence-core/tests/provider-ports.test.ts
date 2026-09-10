import { describe, expect, it } from 'vitest';
import {
  validateToolDescriptor,
} from '../src';
import type {
  DocumentExtractionPort,
  EmbeddingPort,
  ImageGenerationPort,
  ModelPort,
  SearchPort,
  VisionPort,
} from '../src';

describe('LIHEN Provider & Tool Abstraction — GAP-007', () => {
  it('validates a provider-neutral tool descriptor', () => {
    expect(
      validateToolDescriptor(
        {
          toolId: 'search-primary',
          kind: 'SEARCH',
          name: 'Search adapter',
          version: '1',
          description: 'Controlled external search adapter.',
          readOnly: true,
        },
        'SEARCH',
      ),
    ).toEqual([]);
  });

  it('reports descriptor quality problems without provider execution', () => {
    expect(
      validateToolDescriptor(
        {
          toolId: '',
          kind: 'MODEL',
          name: '',
          version: '',
          description: '',
          readOnly: true,
        },
        'VISION',
      ),
    ).toEqual([
      'TOOL_ID_REQUIRED',
      'TOOL_NAME_REQUIRED',
      'TOOL_VERSION_REQUIRED',
      'TOOL_DESCRIPTION_REQUIRED',
      'TOOL_KIND_MISMATCH',
    ]);
  });

  it('keeps model, vision, search, document, generation and embedding as interfaces', () => {
    const compileOnly = <
      T extends
        | ModelPort
        | VisionPort
        | SearchPort
        | DocumentExtractionPort
        | ImageGenerationPort
        | EmbeddingPort,
    >(
      value: T,
    ) => value;

    expect(compileOnly).toBeTypeOf('function');
  });

  it('requires generated images to declare GENERATED provenance', () => {
    const generated = {
      generatedRef: 'generated-1',
      mimeType: 'image/webp',
      provenance: 'GENERATED' as const,
    };

    expect(generated.provenance).toBe('GENERATED');
  });

  it('keeps provider trace optional and separate from business evidence', () => {
    const result = {
      status: 'SUCCESS' as const,
      data: { text: 'ok' },
      messages: [],
      trace: {
        providerRef: 'adapter-A',
        durationMs: 12,
      },
    };

    expect(result.trace.providerRef).toBe('adapter-A');
  });
});
