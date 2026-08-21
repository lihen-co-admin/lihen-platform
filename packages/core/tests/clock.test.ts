import { describe, expect, it } from 'vitest';
import { FakeClock } from '../src/clock/clock';

describe('FakeClock', () => {
  it('returns the configured instant', () => {
    const instant = new Date('2026-08-20T12:00:00.000Z');
    expect(new FakeClock(instant).now().toISOString()).toBe(instant.toISOString());
  });
});
