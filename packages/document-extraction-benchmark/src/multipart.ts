import type { DocumentExtraction } from '@lihen/intelligence-core';

import { recordsFromExtraction } from './records';
import type {
  BenchmarkRun,
  CriticalFailure,
  MultipartBenchmarkResult,
} from './types';

function duplicates(values: readonly number[]): readonly number[] {
  const seen = new Set<number>();
  const duplicate = new Set<number>();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate].sort((a, b) => a - b);
}

export function evaluateMultipartRuns(
  parts: readonly BenchmarkRun[],
  expectedPages: readonly number[],
): MultipartBenchmarkResult {
  const successfulData = parts.map((part) => part.result.data).filter(
    (data): data is DocumentExtraction => data !== undefined,
  );
  const refs = new Set(successfulData.map((data) => data.documentRef));
  const allPages = successfulData.flatMap((data) => [...data.pages]);
  const duplicatedPages = duplicates(allPages);
  const normalizedPages = [...new Set(allPages)].sort((a, b) => a - b);
  const missingPages = expectedPages.filter((page) => !normalizedPages.includes(page)).sort((a, b) => a - b);
  const allRowKeys = successfulData.flatMap((data) => recordsFromExtraction(data).map((record) => record.sourceRowKey)).filter(Boolean);
  const seen = new Set<string>();
  const duplicateKeys = new Set<string>();
  for (const key of allRowKeys) {
    if (seen.has(key)) duplicateKeys.add(key);
    seen.add(key);
  }

  const failures = new Set<CriticalFailure>();
  if (duplicatedPages.length > 0 || duplicateKeys.size > 0) failures.add('MULTIPART_DUPLICATION');
  if (refs.size > 1 || missingPages.length > 0) failures.add('MULTIPART_PAGE_DRIFT');

  const providerFailed = parts.some((part) =>
    part.result.status === 'FAILED' ||
    part.result.status === 'UNAVAILABLE' ||
    part.result.status === 'RATE_LIMITED' ||
    part.result.status === 'NO_RESULT'
  );
  const childHardGateFailed = parts.some((part) => !part.hardGate.passed);

  return {
    parts,
    normalizedPages,
    duplicatedPages,
    missingPages,
    duplicatedSourceRowKeys: [...duplicateKeys].sort(),
    mergedRecordCount: allRowKeys.length,
    failures: [...failures],
    passed: failures.size === 0 && !providerFailed && !childHardGateFailed,
  };
}
