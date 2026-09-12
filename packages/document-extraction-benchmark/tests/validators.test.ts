import { describe, expect, it } from 'vitest';

import {
  validateCaseExpectations,
  validateDocumentExtraction,
  validateGroundTruth,
  validateProviderResult,
} from '../src';
import { perfectCase, perfectResult, request } from './fixtures';

describe('M08-Y PHASE C validators', () => {
  it('accepts the baseline provider result', () => {
    expect(validateProviderResult(perfectResult)).toEqual([]);
  });
  it('detects a documentRef mismatch', () => {
    expect(validateDocumentExtraction(request(), { ...perfectResult.data!, documentRef: 'wrong-document' }))
      .toContain('BENCHMARK_DOCUMENT_REF_MISMATCH');
  });
  it('accepts a valid ground truth corpus', () => {
    expect(validateGroundTruth([perfectCase])).toEqual([]);
  });
  it('requires trace and enforces critical fields', () => {
    const noTrace = { ...perfectResult, trace: undefined };
    expect(validateCaseExpectations(perfectCase, noTrace)).toContain('BENCHMARK_TRACE_REQUIRED');
    const wrongProduct = {
      ...perfectResult,
      data: {
        ...perfectResult.data!,
        fields: { records: [{ ...((perfectResult.data!.fields.records as Record<string, unknown>[])[0]), productName: 'Wrong' }] },
      },
    };
    expect(validateCaseExpectations(perfectCase, wrongProduct))
      .toContain('BENCHMARK_CRITICAL_FIELD_MISMATCH:p1-r1:productName');
  });
});
