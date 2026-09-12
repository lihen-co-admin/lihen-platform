import type {
  DocumentExtraction,
  DocumentExtractionPort,
  DocumentExtractionRequest,
  ProviderResult,
  ToolDescriptor,
} from '@lihen/intelligence-core';

export function benchmarkRequestKey(request: DocumentExtractionRequest): string {
  const from = request.pageRange?.from ?? 'ALL';
  const to = request.pageRange?.to ?? 'ALL';
  return [request.document.documentRef, String(from), String(to)].join(':');
}

export class FakeDocumentExtractionPort implements DocumentExtractionPort {
  readonly descriptor: ToolDescriptor = {
    toolId: 'document-benchmark-fake',
    kind: 'DOCUMENT',
    name: 'Document Benchmark Fake',
    version: '2',
    description: 'Deterministic fake for document extraction benchmark tests.',
    readOnly: true,
  };

  private readonly calls = new Map<string, number>();

  constructor(
    private readonly responses: ReadonlyMap<string, ProviderResult<DocumentExtraction>>,
  ) {}

  callCount(request: DocumentExtractionRequest): number {
    return this.calls.get(benchmarkRequestKey(request)) ?? 0;
  }

  async extract(request: DocumentExtractionRequest): Promise<ProviderResult<DocumentExtraction>> {
    const key = benchmarkRequestKey(request);
    this.calls.set(key, (this.calls.get(key) ?? 0) + 1);
    const result = this.responses.get(key);
    if (!result) {
      return { status: 'NO_RESULT', messages: ['BENCHMARK_FAKE_RESULT_NOT_CONFIGURED'] };
    }
    return structuredClone(result);
  }
}
