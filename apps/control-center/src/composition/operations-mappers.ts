/**
 * GAP-009 — Operations Facade primitive response mappers.
 *
 * Extracted from operations.ts without semantic changes.
 * These helpers contain no database access and no policy.
 */

export function numberValue(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

export function rowObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function firstRpcRow(data: unknown): Record<string, unknown> | null {
  const candidate = Array.isArray(data) ? data[0] : data;
  return candidate && typeof candidate === 'object'
    ? (candidate as Record<string, unknown>)
    : null;
}

export function booleanValue(value: unknown): boolean {
  return value === true;
}
