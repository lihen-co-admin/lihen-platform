import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('GAP-044 real sub-evidence integration', () => {
  const source = readFileSync(
    'tools/lihen-quality-gate.mjs',
    'utf8',
  );

  it('requires sha256-authenticated evidence', () => {
    expect(source).toContain('evidenceSha256');
    expect(source).toContain('/^[0-9a-f]{64}$/i');
  });

  it('verifies all four external evidences', () => {
    expect(source).toContain('verifyProductionReadinessSubEvidence');
    expect(source).toContain('verifyExternalProductionEvidence');
    expect(source).toContain('LIHEN_PRODUCTION_BACKUP_EVIDENCE_V1');
    expect(source).toContain('LIHEN_PRODUCTION_ROLLBACK_REHEARSAL_EVIDENCE_V1');
    expect(source).toContain('LIHEN_PRODUCTION_MONITORING_EVIDENCE_V1');
    expect(source).toContain('LIHEN_MIGRATION_REPRODUCIBILITY_EVIDENCE_V1');
  });

  it('fails closed on external verification error', () => {
    expect(source).toContain(
      'External sub-evidence verification failed:',
    );
  });
});
