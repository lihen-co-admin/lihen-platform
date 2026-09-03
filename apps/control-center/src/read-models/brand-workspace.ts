import type { BrandDTO } from '@lihen/products';

export type BrandWorkspacePersistenceState =
  | 'FOUNDATION_READY_PERSISTENCE_PENDING';

export interface BrandWorkspaceItem {
  readonly id: string;
  readonly name: string;
  readonly normalizedName: string;
  readonly status: BrandDTO['status'];
  readonly persistenceState: BrandWorkspacePersistenceState;
  readonly assetFoundationLabel: string;
  readonly manualProtectionLabel: string;
  readonly reviewBoundaryLabel: string;
  readonly mutationBoundaryLabel: string;
  readonly manualVerifiedProtected: true;
  readonly requiresGovernedMutation: true;
  readonly canMutateCanonicalIdentityFromPresentation: false;
}

export interface BrandWorkspaceReadModel {
  readonly total: number;
  readonly active: number;
  readonly inactive: number;
  readonly protectedByGovernance: number;
  readonly items: readonly BrandWorkspaceItem[];
}

export function buildBrandWorkspaceReadModel(
  brands: readonly BrandDTO[],
): BrandWorkspaceReadModel {
  const items = brands.map<BrandWorkspaceItem>((brand) => ({
    id: brand.id,
    name: brand.name,
    normalizedName: brand.normalizedName,
    status: brand.status,
    persistenceState: 'FOUNDATION_READY_PERSISTENCE_PENDING',
    assetFoundationLabel: '1:N formalizado · persistencia pendiente',
    manualProtectionLabel: 'MANUAL_VERIFIED protegido',
    reviewBoundaryLabel: 'Unified Human Review Queue',
    mutationBoundaryLabel: 'Existing Control Plane requerido',
    manualVerifiedProtected: true,
    requiresGovernedMutation: true,
    canMutateCanonicalIdentityFromPresentation: false,
  }));

  const active = items.filter((item) => item.status === 'ACTIVE').length;

  return {
    total: items.length,
    active,
    inactive: items.length - active,
    protectedByGovernance: items.filter(
      (item) =>
        item.manualVerifiedProtected &&
        item.requiresGovernedMutation &&
        !item.canMutateCanonicalIdentityFromPresentation,
    ).length,
    items,
  };
}
