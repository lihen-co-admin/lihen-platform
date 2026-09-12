import { describe, expect, it } from 'vitest';

import { FakeDocumentExtractionPort, benchmarkRequestKey } from '../src';
import { perfectResult, rateLimitedResult, request, unavailableResult } from './fixtures';

describe('M08-Y PHASE C FakeDocumentExtractionPort', () => {
  it('returns deterministic defensive copies', async () => {
    const req = request();
    const port = new FakeDocumentExtractionPort(new Map([[benchmarkRequestKey(req), perfectResult]]));
    const first = await port.extract(req);
    const second = await port.extract(req);
    expect(first).toEqual(perfectResult);
    expect(second).toEqual(perfectResult);
    expect(first).not.toBe(second);
    expect(port.callCount(req)).toBe(2);
  });
  it('returns NO_RESULT when no fixture exists', async () => {
    const result = await new FakeDocumentExtractionPort(new Map()).extract(request());
    expect(result.status).toBe('NO_RESULT');
  });
  it('uses pageRange in the request key', () => {
    expect(benchmarkRequestKey(request({ from: 1, to: 20 }))).toBe('benchmark-doc-1:1:20');
  });
  it('declares the fake as read-only', () => {
    const port = new FakeDocumentExtractionPort(new Map());
    expect(port.descriptor.kind).toBe('DOCUMENT');
    expect(port.descriptor.readOnly).toBe(true);
  });
  it('supports RATE_LIMITED and UNAVAILABLE provider scenarios', async () => {
    const one = request({ from: 1, to: 1 });
    const two = request({ from: 2, to: 2 });
    const port = new FakeDocumentExtractionPort(new Map([
      [benchmarkRequestKey(one), rateLimitedResult],
      [benchmarkRequestKey(two), unavailableResult],
    ]));
    expect((await port.extract(one)).status).toBe('RATE_LIMITED');
    expect((await port.extract(two)).status).toBe('UNAVAILABLE');
  });
});
