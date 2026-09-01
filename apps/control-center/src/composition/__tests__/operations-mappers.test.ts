import { describe, expect, it } from 'vitest';
import {
  booleanValue,
  firstRpcRow,
  numberValue,
  rowObject,
} from '../operations-mappers';

describe('GAP-009 operations primitive mappers', () => {
  it('preserves number conversion behavior', () => {
    expect(numberValue(7)).toBe(7);
    expect(numberValue('8')).toBe(8);
    expect(numberValue(null)).toBe(0);
  });

  it('preserves row object behavior', () => {
    const object = { id: 'x' };
    expect(rowObject(object)).toBe(object);
    expect(rowObject([])).toEqual({});
    expect(rowObject(null)).toEqual({});
  });

  it('preserves first RPC row behavior', () => {
    expect(firstRpcRow([{ id: 1 }, { id: 2 }])).toEqual({ id: 1 });
    expect(firstRpcRow({ id: 3 })).toEqual({ id: 3 });
    expect(firstRpcRow(null)).toBeNull();
  });

  it('preserves strict boolean behavior', () => {
    expect(booleanValue(true)).toBe(true);
    expect(booleanValue(false)).toBe(false);
    expect(booleanValue(1)).toBe(false);
    expect(booleanValue('true')).toBe(false);
  });
});
