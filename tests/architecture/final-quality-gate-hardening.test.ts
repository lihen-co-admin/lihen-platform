import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('final architecture quality gate hardening', () => {
  it('rejects missing or failing architecture evidence through the gate self-test', () => {
    const output = execFileSync(
      process.execPath,
      ['tools/lihen-quality-gate.mjs', '--self-test'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    expect(output).toContain('LIHEN quality gate self-test: 21/21 PASS');
  });
});
