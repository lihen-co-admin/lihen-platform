import { describe, expect, it } from 'vitest';
import {
  evaluateSecurityBoundary,
  RLS_PERMISSION_MATRIX_VNEXT,
} from '../src';

describe('WAVE 12 / GAP-040 RLS & Permission Matrix VNext', () => {
  it('denies direct browser table writes', () => {
    expect(
      evaluateSecurityBoundary(
        'BROWSER_AUTHENTICATED',
        'DIRECT_TABLE_WRITE',
      ).decision,
    ).toBe('DENY');
  });

  it('allows browser controlled RPC execution only conditionally', () => {
    expect(
      evaluateSecurityBoundary(
        'BROWSER_AUTHENTICATED',
        'CONTROLLED_RPC_EXECUTE',
      ).decision,
    ).toBe('CONDITIONAL');
  });

  it('denies service maintenance and RLS bypass in the browser', () => {
    expect(
      evaluateSecurityBoundary(
        'BROWSER_AUTHENTICATED',
        'SERVICE_MAINTENANCE',
      ).decision,
    ).toBe('DENY');

    expect(
      evaluateSecurityBoundary(
        'BROWSER_AUTHENTICATED',
        'RLS_BYPASS',
      ).decision,
    ).toBe('DENY');
  });

  it('denies Intelligence mutation, controlled execution and RLS bypass', () => {
    expect(
      evaluateSecurityBoundary('INTELLIGENCE', 'DIRECT_TABLE_WRITE')
        .decision,
    ).toBe('DENY');

    expect(
      evaluateSecurityBoundary('INTELLIGENCE', 'CONTROLLED_RPC_EXECUTE')
        .decision,
    ).toBe('DENY');

    expect(
      evaluateSecurityBoundary('INTELLIGENCE', 'RLS_BYPASS').decision,
    ).toBe('DENY');
  });

  it('keeps service-role operations conditional instead of globally allowed', () => {
    expect(
      evaluateSecurityBoundary(
        'SERVER_SERVICE_ROLE',
        'SERVICE_MAINTENANCE',
      ).decision,
    ).toBe('CONDITIONAL');

    expect(
      evaluateSecurityBoundary(
        'SERVER_SERVICE_ROLE',
        'DIRECT_TABLE_WRITE',
      ).decision,
    ).toBe('CONDITIONAL');
  });

  it('covers every actor/surface pair exactly once', () => {
    const actors = [
      'BROWSER_AUTHENTICATED',
      'SERVER_SERVICE_ROLE',
      'INTELLIGENCE',
    ] as const;
    const surfaces = [
      'PUBLIC_TABLE_READ',
      'DIRECT_TABLE_WRITE',
      'CONTROLLED_RPC_EXECUTE',
      'SERVICE_MAINTENANCE',
      'RLS_BYPASS',
    ] as const;

    expect(RLS_PERMISSION_MATRIX_VNEXT).toHaveLength(
      actors.length * surfaces.length,
    );

    for (const actor of actors) {
      for (const surface of surfaces) {
        const matches = RLS_PERMISSION_MATRIX_VNEXT.filter(
          (entry) => entry.actor === actor && entry.surface === surface,
        );
        expect(matches).toHaveLength(1);
      }
    }
  });
});
