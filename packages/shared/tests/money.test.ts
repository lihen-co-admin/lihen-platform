import { describe, expect, it } from 'vitest';
import { Money } from '../src/money';

describe('Money', () => {
  it('creates a valid COP amount', () => {
    const money = new Money(25_000, 'COP');
    expect(money.amount).toBe(25_000);
    expect(money.currency).toBe('COP');
  });

  it('rejects negative amounts', () => {
    expect(() => new Money(-1, 'COP')).toThrow();
  });

  it('does not add different currencies', () => {
    expect(() => new Money(1, 'COP').add(new Money(1, 'USD'))).toThrow();
  });
});
