import { describe, expect, it } from 'vitest';

import {
  FakeDocumentExtractionPort,
  benchmarkRequestKey,
  runBenchmarkCase,
} from '../src';
import {
  perfectCase,
  perfectResult,
  warningResult,
} from './fixtures';

describe('M08-Y PHASE C benchmark runner', () => {
  it('runs the same provider-neutral case through DocumentExtractionPort', async () => {
    const port = new FakeDocumentExtractionPort(new Map([[benchmarkRequestKey(perfectCase.request), perfectResult]]));
    const run = await runBenchmarkCase({ candidateId: 'fake-perfect', displayName: 'Fake Perfect', port }, perfectCase);
    expect(run.candidateId).toBe('fake-perfect');
    expect(run.score.total).toBe(1);
    expect(run.hardGate.passed).toBe(true);
    expect(run.validationIssues).toEqual([]);
    expect(run.expectationIssues).toEqual([]);
    expect(run.passed).toBe(true);
  });

  it('enforces expected status, partial policy, warnings and trace without rewriting provider output', async () => {
    const testCase = {
      ...perfectCase,
      expectations: {
        ...perfectCase.expectations,
        expectedStatus: 'SUCCESS' as const,
        allowPartial: false,
        allowWarnings: false,
        requireTrace: true,
      },
    };
    const port = new FakeDocumentExtractionPort(new Map([[benchmarkRequestKey(testCase.request), warningResult]]));
    const run = await runBenchmarkCase({ candidateId: 'fake-warning', displayName: 'Fake Warning', port }, testCase);
    expect(run.result).toEqual(warningResult);
    expect(run.expectationIssues).toContain('BENCHMARK_EXPECTED_STATUS:SUCCESS:PARTIAL');
    expect(run.expectationIssues).toContain('BENCHMARK_PARTIAL_NOT_ALLOWED');
    expect(run.expectationIssues).toContain('BENCHMARK_WARNINGS_NOT_ALLOWED');
    expect(run.passed).toBe(false);
  });
});
