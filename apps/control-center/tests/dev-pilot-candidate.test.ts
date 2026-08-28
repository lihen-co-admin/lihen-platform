import { describe, expect, it } from 'vitest';
import { assessDevPilotCandidate } from '../src/domain/dev-pilot-candidate';

describe('assessDevPilotCandidate', () => {
  it('selects suppliers as the first low-blast-radius DEV candidate', () => {
    expect(assessDevPilotCandidate('SUPPLIERS')).toEqual({
      capability: 'SUPPLIERS',
      blastRadius: 'REFERENCE_DATA',
      candidateForFirstPilot: true,
      rationale:
        'Supplier maintenance is reference-data oriented and does not inherently create stock, order, sale or finance movements.',
      requiresCompensationProof: true,
      requiresIsolatedFixture: true,
    });
  });

  it('does not select Product Master before the reference-data pilot', () => {
    const result = assessDevPilotCandidate('PRODUCT_MASTER');

    expect(result.blastRadius).toBe('PRODUCT_MASTER_DATA');
    expect(result.candidateForFirstPilot).toBe(false);
  });

  it.each(['INVENTORY', 'PROCUREMENT', 'ORDERS', 'SALES', 'FINANCE'] as const)(
    'keeps %s behind the first supplier pilot',
    (capability) => {
      const result = assessDevPilotCandidate(capability);

      expect(result.candidateForFirstPilot).toBe(false);
      expect(result.requiresCompensationProof).toBe(true);
      expect(result.requiresIsolatedFixture).toBe(true);
    },
  );

  it.each(['OPERATION_DISPATCH', 'CANARY', 'FINAL_RELEASE', 'PRODUCTION'] as const)(
    'keeps %s outside the domain pilot',
    (capability) => {
      const result = assessDevPilotCandidate(capability);

      expect(result.candidateForFirstPilot).toBe(false);
      expect(result.blastRadius).toBeNull();
    },
  );
});
