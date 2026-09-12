import { describe, expect, it } from 'vitest';
import type { DocumentExtractionBenchmarkCase } from '../src';
import { validateGroundTruth } from '../src';
import { request } from './fixtures';

const specs = [
  ['BC-001', 'BEAUTY_CARE', 'DIGITAL_SIMPLE'],
  ['BC-002', 'BEAUTY_CARE', 'VISUAL_CATALOG'],
  ['BC-003', 'BEAUTY_CARE', 'TABLE_PRICING'],
  ['ST-001', 'STYLE', 'VISUAL_CATALOG'],
  ['ST-002', 'STYLE', 'MULTI_VARIANT'],
  ['ST-003', 'STYLE', 'SCANNED'],
  ['EDGE-001', 'EDGE', 'LOW_QUALITY'],
  ['EDGE-002', 'EDGE', 'SCANNED'],
  ['EDGE-003', 'EDGE', 'SIZE_LIMIT'],
  ['MP-001', 'MIXED', 'MULTIPART'],
  ['MP-002', 'BEAUTY_CARE', 'MULTIPART'],
  ['MP-003', 'STYLE', 'MULTIPART'],
  ['MP-004', 'EDGE', 'MULTIPART'],
  ['MP-005', 'MIXED', 'MULTIPART'],
] as const;

const cases: readonly DocumentExtractionBenchmarkCase[] = specs.map(([caseId, category, scenario], index) => {
  const documentRef = `golden-${caseId.toLowerCase()}`;
  const base = request();
  return {
    caseId,
    category,
    scenario,
    request: {
      ...base,
      document: { ...base.document, documentRef, sourceUri: `lihen://benchmark/${documentRef}` },
    },
    groundTruth: {
      documentRef,
      expectedPages: [1],
      records: [{
        recordId: `${caseId}-record-1`,
        sourceRowKey: `${caseId}-p1-r1`,
        sourcePage: 1,
        expected: {
          productName: `Fixture ${index + 1}`,
          businessLine: category === 'STYLE' ? 'STYLE' : category === 'BEAUTY_CARE' ? 'BEAUTY_CARE' : undefined,
        },
      }],
    },
    expectations: {
      expectedStatus: 'SUCCESS',
      allowWarnings: scenario === 'LOW_QUALITY' || scenario === 'SCANNED',
      allowPartial: scenario === 'LOW_QUALITY' || scenario === 'SCANNED',
      requireTrace: true,
      criticalFields: ['productName', 'sourcePage'],
      ...(scenario === 'MULTIPART' ? { multipart: { expectedPages: [1] } } : {}),
    },
  };
});

describe('M08-Y PHASE C golden corpus minimum coverage', () => {
  it('contains the frozen minimum case ids', () => {
    expect(cases.map((item) => item.caseId)).toEqual(specs.map(([caseId]) => caseId));
  });
  it('contains Beauty Care, Style, Edge and multipart coverage', () => {
    expect(new Set(cases.map((item) => item.category))).toEqual(new Set(['BEAUTY_CARE', 'STYLE', 'EDGE', 'MIXED']));
    expect(cases.filter((item) => item.scenario === 'MULTIPART')).toHaveLength(5);
  });
  it('passes ground-truth structural validation', () => {
    expect(validateGroundTruth(cases)).toEqual([]);
  });
});
