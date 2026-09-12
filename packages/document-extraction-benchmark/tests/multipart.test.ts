import { describe, expect, it } from 'vitest';

import { evaluateMultipartRuns, FakeDocumentExtractionPort, benchmarkRequestKey, runBenchmarkCase } from '../src';
import type { BenchmarkRun } from '../src';
import { perfectCase, perfectResult, request } from './fixtures';

function run(id: string, pages: readonly number[], rowKey: string, status: BenchmarkRun['result']['status'] = 'SUCCESS'): BenchmarkRun {
  return {
    runId: id,
    candidateId: 'fake',
    caseId: 'MP-001',
    startedAt: '2026-09-12T00:00:00.000Z',
    finishedAt: '2026-09-12T00:00:01.000Z',
    result: {
      status,
      ...(status === 'SUCCESS' || status === 'PARTIAL' ? {
        data: { documentRef: 'logical-doc-1', fields: { records: [{ sourceRowKey: rowKey, sourcePage: pages[0] ?? null }] }, pages, warnings: [] },
      } : {}),
      messages: [],
    },
    validationIssues: [],
    expectationIssues: [],
    score: {
      total: 1,
      dimensions: { recordDetection: 1, productIdentity: 1, supplierReference: 1, brand: 1, classification: 1, pricing: 1, quantity: 1, pageAttribution: 1, imageAssociation: 1, falseMergeControl: 1 },
      inventedValueRate: 0,
      missingRecordRate: 0,
    },
    hardGate: { passed: true, failures: [] },
    passed: status === 'SUCCESS' || status === 'PARTIAL',
  };
}

describe('M08-Y PHASE C multipart validator', () => {
  it('merges contiguous parts deterministically', () => {
    const result = evaluateMultipartRuns([run('a', [1, 2], 'p1-r1'), run('b', [3, 4], 'p3-r1')], [1, 2, 3, 4]);
    expect(result.passed).toBe(true);
    expect(result.normalizedPages).toEqual([1, 2, 3, 4]);
    expect(result.failures).toEqual([]);
  });
  it('maps duplicate pages and sourceRowKeys to MULTIPART_DUPLICATION', () => {
    const result = evaluateMultipartRuns([run('a', [1, 2], 'same'), run('b', [2, 3], 'same')], [1, 2, 3]);
    expect(result.passed).toBe(false);
    expect(result.failures).toContain('MULTIPART_DUPLICATION');
  });
  it('maps missing pages to MULTIPART_PAGE_DRIFT', () => {
    const result = evaluateMultipartRuns([run('a', [1, 3], 'p1-r1')], [1, 2, 3]);
    expect(result.failures).toContain('MULTIPART_PAGE_DRIFT');
  });
  it('fails a provider-unavailable part but permits PARTIAL to remain explicitly partial', () => {
    expect(evaluateMultipartRuns([run('a', [1], 'a', 'UNAVAILABLE')], [1]).passed).toBe(false);
    expect(evaluateMultipartRuns([run('a', [1], 'a', 'PARTIAL')], [1]).passed).toBe(true);
  });
  it('supports independent retry by part and preserves provider trace/warnings', async () => {
    const partRequest = request({ from: 1, to: 1 });
    const traced = {
      ...perfectResult,
      data: { ...perfectResult.data!, pages: [1], warnings: ['kept-warning'] },
      messages: ['kept-message'],
      trace: { providerRef: 'benchmark-fake', requestRef: 'part-1', durationMs: 4 },
    };
    const port = new FakeDocumentExtractionPort(new Map([[benchmarkRequestKey(partRequest), traced]]));
    const partCase = { ...perfectCase, request: partRequest, expectations: { ...perfectCase.expectations, allowWarnings: true } };
    const candidate = { candidateId: 'fake', displayName: 'Fake', port };
    const first = await runBenchmarkCase(candidate, partCase);
    const retry = await runBenchmarkCase(candidate, partCase);
    expect(port.callCount(partRequest)).toBe(2);
    expect(retry.result.trace).toEqual(traced.trace);
    expect(retry.result.messages).toEqual(['kept-message']);
    expect(retry.result.data?.warnings).toEqual(['kept-warning']);
    expect(first.result).toEqual(retry.result);
  });
});
