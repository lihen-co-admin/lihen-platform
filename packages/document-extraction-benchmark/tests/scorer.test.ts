import { describe, expect, it } from 'vitest';

import { evaluateHardGates, scoreExtraction } from '../src';
import { perfectCase, perfectResult } from './fixtures';

function withRecords(records: readonly Record<string, unknown>[]) {
  return {
    ...perfectResult,
    data: { ...perfectResult.data!, fields: { records } },
  };
}

const baseRecord = () => ({ ...((perfectResult.data!.fields.records as Record<string, unknown>[])[0]) });

describe('M08-Y PHASE C scorer', () => {
  it('scores a perfect extraction as 1.0', () => {
    const score = scoreExtraction(perfectCase.groundTruth, perfectResult);
    expect(score.total).toBe(1);
    expect(score.missingRecordRate).toBe(0);
    expect(score.inventedValueRate).toBe(0);
  });
  it('detects invented product identity', () => {
    const result = withRecords([{ ...baseRecord(), productName: 'Inventado' }]);
    expect(evaluateHardGates(perfectCase.groundTruth, result).failures).toContain('INVENTED_PRODUCT_IDENTITY');
  });
  it('detects unitCost and suggestedSalePrice association errors', () => {
    const wrongCost = withRecords([{ ...baseRecord(), unitCost: 99999 }]);
    const wrongSuggested = withRecords([{ ...baseRecord(), suggestedSalePrice: 99999 }]);
    expect(evaluateHardGates(perfectCase.groundTruth, wrongCost).failures).toContain('WRONG_PRICE_ASSOCIATION');
    expect(evaluateHardGates(perfectCase.groundTruth, wrongSuggested).failures).toContain('WRONG_PRICE_ASSOCIATION');
  });
  it('penalizes a missing record without falsely calling it a merge', () => {
    const result = withRecords([]);
    const score = scoreExtraction(perfectCase.groundTruth, result);
    const gates = evaluateHardGates(perfectCase.groundTruth, result);
    expect(score.missingRecordRate).toBe(1);
    expect(gates.failures).not.toContain('FALSE_PRODUCT_MERGE');
  });
  it('detects an actual combined identity false merge', () => {
    const gt = {
      documentRef: 'benchmark-doc-1',
      expectedPages: [1],
      records: [
        { recordId: 'a', sourceRowKey: 'a', sourcePage: 1, expected: { productName: 'Producto Alfa' } },
        { recordId: 'b', sourceRowKey: 'b', sourcePage: 1, expected: { productName: 'Producto Beta' } },
      ],
    };
    const result = withRecords([{ ...baseRecord(), sourceRowKey: 'merged', productName: 'Producto Alfa + Producto Beta' }]);
    expect(evaluateHardGates(gt, result).failures).toContain('FALSE_PRODUCT_MERGE');
  });
  it('detects dropped required warnings without treating every SUCCESS warning as PARTIAL', () => {
    const noWarning = evaluateHardGates(perfectCase.groundTruth, perfectResult, {
      ...perfectCase.expectations,
      requiredWarningFragments: ['OCR_LOW_CONFIDENCE'],
    });
    expect(noWarning.failures).toContain('WARNINGS_DROPPED');

    const successWithWarning = {
      ...perfectResult,
      messages: ['INFORMATIONAL_WARNING'],
    };
    expect(evaluateHardGates(perfectCase.groundTruth, successWithWarning, perfectCase.expectations).failures)
      .not.toContain('PARTIAL_REPORTED_AS_SUCCESS');
  });
});
