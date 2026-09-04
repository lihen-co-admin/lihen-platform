import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('GAP-044 production readiness gate hardening', () => {
  it('fails closed when critical production-readiness evidence is missing or unsafe', () => {
    const output = execFileSync(
      process.execPath,
      ['tools/lihen-quality-gate.mjs', '--self-test-production-readiness'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    expect(output).toContain(
      'LIHEN production readiness self-test: 9/9 PASS',
    );
  });
});
