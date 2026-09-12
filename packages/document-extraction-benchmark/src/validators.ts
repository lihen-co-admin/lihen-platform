import type {
  DocumentExtraction,
  DocumentExtractionRequest,
  ProviderOperationStatus,
  ProviderResult,
} from '@lihen/intelligence-core';

import { recordsFromExtraction } from './records';
import type {
  BenchmarkFieldName,
  DocumentExtractionBenchmarkCase,
} from './types';

const STATUSES = new Set<ProviderOperationStatus>([
  'SUCCESS',
  'PARTIAL',
  'NO_RESULT',
  'RATE_LIMITED',
  'UNAVAILABLE',
  'FAILED',
]);

function normalized(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function fieldMatches(
  field: BenchmarkFieldName,
  expected: DocumentExtractionBenchmarkCase['groundTruth']['records'][number],
  actual: ReturnType<typeof recordsFromExtraction>[number],
): boolean {
  switch (field) {
    case 'sourcePage':
      return expected.sourcePage === actual.sourcePage;
    case 'sourceSlot':
      return normalized(expected.sourceSlot) === normalized(actual.sourceSlot);
    case 'unitCost':
    case 'suggestedSalePrice':
    case 'quantityHint':
      return expected.expected[field] === undefined || expected.expected[field] === actual[field];
    default:
      return expected.expected[field] === undefined || normalized(expected.expected[field] as string | null | undefined) === normalized(actual[field] as string | null | undefined);
  }
}

export function validateProviderResult(
  result: ProviderResult<DocumentExtraction>,
): readonly string[] {
  const issues: string[] = [];

  if (!STATUSES.has(result.status)) issues.push('BENCHMARK_UNKNOWN_PROVIDER_STATUS');
  if (!Array.isArray(result.messages)) issues.push('BENCHMARK_PROVIDER_MESSAGES_REQUIRED');
  if (result.status === 'SUCCESS' && !result.data) issues.push('BENCHMARK_SUCCESS_REQUIRES_DATA');
  if (result.trace?.durationMs !== undefined && (!Number.isFinite(result.trace.durationMs) || result.trace.durationMs < 0)) {
    issues.push('BENCHMARK_INVALID_TRACE_DURATION');
  }

  return issues;
}

export function validateDocumentExtraction(
  request: DocumentExtractionRequest,
  extraction: DocumentExtraction,
): readonly string[] {
  const issues: string[] = [];

  if (!extraction.documentRef.trim()) issues.push('BENCHMARK_DOCUMENT_REF_REQUIRED');
  if (extraction.documentRef !== request.document.documentRef) issues.push('BENCHMARK_DOCUMENT_REF_MISMATCH');
  if (!extraction.fields || typeof extraction.fields !== 'object' || Array.isArray(extraction.fields)) {
    issues.push('BENCHMARK_FIELDS_OBJECT_REQUIRED');
  }

  const seen = new Set<number>();
  let previous = 0;
  for (const page of extraction.pages) {
    if (!Number.isInteger(page) || page <= 0) {
      issues.push('BENCHMARK_INVALID_PAGE');
      continue;
    }
    if (seen.has(page)) issues.push('BENCHMARK_DUPLICATE_PAGE');
    if (page < previous) issues.push('BENCHMARK_NON_DETERMINISTIC_PAGE_ORDER');
    seen.add(page);
    previous = page;
  }

  if (!Array.isArray(extraction.warnings)) issues.push('BENCHMARK_WARNINGS_ARRAY_REQUIRED');
  return issues;
}

export function validateCaseExpectations(
  benchmarkCase: DocumentExtractionBenchmarkCase,
  result: ProviderResult<DocumentExtraction>,
): readonly string[] {
  const issues: string[] = [];
  const expectations = benchmarkCase.expectations;
  const warnings = [
    ...result.messages,
    ...(result.data?.warnings ?? []),
  ];

  if (expectations.expectedStatus && result.status !== expectations.expectedStatus) {
    issues.push(`BENCHMARK_EXPECTED_STATUS:${expectations.expectedStatus}:${result.status}`);
  }
  if (!expectations.allowPartial && result.status === 'PARTIAL') {
    issues.push('BENCHMARK_PARTIAL_NOT_ALLOWED');
  }
  if (!expectations.allowWarnings && warnings.length > 0) {
    issues.push('BENCHMARK_WARNINGS_NOT_ALLOWED');
  }
  if (expectations.requireTrace && !result.trace) {
    issues.push('BENCHMARK_TRACE_REQUIRED');
  }

  for (const fragment of expectations.requiredWarningFragments ?? []) {
    if (!warnings.some((warning) => warning.includes(fragment))) {
      issues.push(`BENCHMARK_WARNING_DROPPED:${fragment}`);
    }
  }

  const actual = result.data ? recordsFromExtraction(result.data) : [];
  const criticalFields = new Set(expectations.criticalFields);
  for (const ground of benchmarkCase.groundTruth.records) {
    const record = actual.find((item) => item.sourceRowKey === ground.sourceRowKey);
    if (!record) continue;
    for (const field of criticalFields) {
      if (!fieldMatches(field, ground, record)) {
        issues.push(`BENCHMARK_CRITICAL_FIELD_MISMATCH:${ground.sourceRowKey}:${field}`);
      }
    }
  }

  return issues;
}

function validatePositiveUniquePages(
  pages: readonly number[],
  label: string,
  issues: string[],
): void {
  const seen = new Set<number>();
  let previous = 0;
  for (const page of pages) {
    if (!Number.isInteger(page) || page <= 0) issues.push(`${label}:INVALID_PAGE:${page}`);
    if (seen.has(page)) issues.push(`${label}:DUPLICATE_PAGE:${page}`);
    if (page < previous) issues.push(`${label}:NON_DETERMINISTIC_ORDER`);
    seen.add(page);
    previous = page;
  }
}

export function validateGroundTruth(
  cases: readonly DocumentExtractionBenchmarkCase[],
): readonly string[] {
  const issues: string[] = [];
  const caseIds = new Set<string>();

  for (const benchmarkCase of cases) {
    if (caseIds.has(benchmarkCase.caseId)) issues.push(`BENCHMARK_DUPLICATE_CASE:${benchmarkCase.caseId}`);
    caseIds.add(benchmarkCase.caseId);

    const gt = benchmarkCase.groundTruth;
    if (gt.documentRef !== benchmarkCase.request.document.documentRef) {
      issues.push(`BENCHMARK_GROUND_TRUTH_REF_MISMATCH:${benchmarkCase.caseId}`);
    }

    validatePositiveUniquePages(gt.expectedPages, `BENCHMARK_EXPECTED_PAGES:${benchmarkCase.caseId}`, issues);
    if (benchmarkCase.expectations.multipart) {
      validatePositiveUniquePages(
        benchmarkCase.expectations.multipart.expectedPages,
        `BENCHMARK_MULTIPART_EXPECTED_PAGES:${benchmarkCase.caseId}`,
        issues,
      );
    }
    if (benchmarkCase.scenario === 'MULTIPART' && !benchmarkCase.expectations.multipart) {
      issues.push(`BENCHMARK_MULTIPART_EXPECTATION_REQUIRED:${benchmarkCase.caseId}`);
    }
    if (benchmarkCase.expectations.expectedStatus === 'PARTIAL' && !benchmarkCase.expectations.allowPartial) {
      issues.push(`BENCHMARK_CONTRADICTORY_PARTIAL_EXPECTATION:${benchmarkCase.caseId}`);
    }
    if (new Set(benchmarkCase.expectations.criticalFields).size !== benchmarkCase.expectations.criticalFields.length) {
      issues.push(`BENCHMARK_DUPLICATE_CRITICAL_FIELD:${benchmarkCase.caseId}`);
    }

    const recordIds = new Set<string>();
    const rowKeys = new Set<string>();
    for (const record of gt.records) {
      if (recordIds.has(record.recordId)) issues.push(`BENCHMARK_DUPLICATE_RECORD_ID:${benchmarkCase.caseId}:${record.recordId}`);
      recordIds.add(record.recordId);
      if (rowKeys.has(record.sourceRowKey)) issues.push(`BENCHMARK_DUPLICATE_SOURCE_ROW_KEY:${benchmarkCase.caseId}:${record.sourceRowKey}`);
      rowKeys.add(record.sourceRowKey);

      if (record.sourcePage !== null && (!Number.isInteger(record.sourcePage) || record.sourcePage <= 0)) {
        issues.push(`BENCHMARK_INVALID_SOURCE_PAGE:${benchmarkCase.caseId}:${record.recordId}`);
      }
      if (record.sourcePage !== null && !gt.expectedPages.includes(record.sourcePage)) {
        issues.push(`BENCHMARK_SOURCE_PAGE_OUTSIDE_EXPECTED:${benchmarkCase.caseId}:${record.recordId}`);
      }

      for (const value of [record.expected.unitCost, record.expected.suggestedSalePrice, record.expected.quantityHint]) {
        if (value !== undefined && value !== null && value < 0) {
          issues.push(`BENCHMARK_NEGATIVE_EXPECTATION:${benchmarkCase.caseId}:${record.recordId}`);
        }
      }
    }
  }

  return issues;
}

export function assertValidBenchmarkCases(
  cases: readonly DocumentExtractionBenchmarkCase[],
): void {
  const issues = validateGroundTruth(cases);
  if (issues.length > 0) throw new Error(issues.join('\n'));
}
