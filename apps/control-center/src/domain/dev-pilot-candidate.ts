import type { DevPilotCapability } from './dev-activation-preflight';

export type DevPilotBlastRadius =
  | 'REFERENCE_DATA'
  | 'PRODUCT_MASTER_DATA'
  | 'STOCK_STATE'
  | 'COMMERCIAL_STATE'
  | 'FINANCIAL_LEDGER';

export interface DevPilotCandidateAssessment {
  readonly capability: DevPilotCapability;
  readonly blastRadius: DevPilotBlastRadius | null;
  readonly candidateForFirstPilot: boolean;
  readonly rationale: string;
  readonly requiresCompensationProof: boolean;
  readonly requiresIsolatedFixture: boolean;
}

/**
 * Selección categórica del primer dominio candidato.
 *
 * No es un ranking numérico y no habilita writes. El objetivo es escoger el
 * dominio con menor acoplamiento transaccional para el primer piloto DEV.
 */
export function assessDevPilotCandidate(
  capability: DevPilotCapability,
): DevPilotCandidateAssessment {
  switch (capability) {
    case 'SUPPLIERS':
      return {
        capability,
        blastRadius: 'REFERENCE_DATA',
        candidateForFirstPilot: true,
        rationale:
          'Supplier maintenance is reference-data oriented and does not inherently create stock, order, sale or finance movements.',
        requiresCompensationProof: true,
        requiresIsolatedFixture: true,
      };

    case 'PRODUCT_MASTER':
      return {
        capability,
        blastRadius: 'PRODUCT_MASTER_DATA',
        candidateForFirstPilot: false,
        rationale:
          'Product Master is canonical data and can affect publishing eligibility and downstream catalog behavior.',
        requiresCompensationProof: true,
        requiresIsolatedFixture: true,
      };

    case 'INVENTORY':
      return {
        capability,
        blastRadius: 'STOCK_STATE',
        candidateForFirstPilot: false,
        rationale:
          'Inventory adjustments mutate stock state and require explicit compensating-adjustment evidence.',
        requiresCompensationProof: true,
        requiresIsolatedFixture: true,
      };

    case 'PROCUREMENT':
    case 'ORDERS':
    case 'SALES':
      return {
        capability,
        blastRadius: 'COMMERCIAL_STATE',
        candidateForFirstPilot: false,
        rationale:
          'Commercial workflows can create linked business state and must follow a lower-blast-radius pilot.',
        requiresCompensationProof: true,
        requiresIsolatedFixture: true,
      };

    case 'FINANCE':
      return {
        capability,
        blastRadius: 'FINANCIAL_LEDGER',
        candidateForFirstPilot: false,
        rationale:
          'Finance is append-only/ledger-sensitive and is not appropriate as the first real DEV mutation.',
        requiresCompensationProof: true,
        requiresIsolatedFixture: true,
      };

    case 'OPERATION_DISPATCH':
    case 'CANARY':
    case 'FINAL_RELEASE':
    case 'PRODUCTION':
      return {
        capability,
        blastRadius: null,
        candidateForFirstPilot: false,
        rationale:
          'Execution-plane and production capabilities remain outside the TANDA 14 domain pilot.',
        requiresCompensationProof: false,
        requiresIsolatedFixture: false,
      };
  }
}
