import { describe, expect, it } from 'vitest';
import { buildBrandWorkspaceReadModel } from '../src/read-models/brand-workspace';

describe('WAVE 5 / GAP-017 Brand Workspace read model', () => {
  it('returns an empty governed workspace for zero brands', () => {
    expect(buildBrandWorkspaceReadModel([])).toEqual({
      total: 0,
      active: 0,
      inactive: 0,
      protectedByGovernance: 0,
      items: [],
    });
  });

  it('projects canonical BrandDTO data without inventing persisted assets', () => {
    const model = buildBrandWorkspaceReadModel([
      {
        id: 'brand-1',
        name: 'Marca Uno',
        normalizedName: 'marca uno',
        status: 'ACTIVE',
      },
    ]);

    expect(model.total).toBe(1);
    expect(model.active).toBe(1);
    expect(model.inactive).toBe(0);
    expect(model.items[0]?.persistenceState).toBe(
      'FOUNDATION_READY_PERSISTENCE_PENDING',
    );
    expect(model.items[0]?.assetFoundationLabel).toContain(
      'persistencia pendiente',
    );
  });

  it('protects manual verified identity and keeps presentation mutation disabled', () => {
    const model = buildBrandWorkspaceReadModel([
      {
        id: 'brand-1',
        name: 'Marca Uno',
        normalizedName: 'marca uno',
        status: 'ACTIVE',
      },
      {
        id: 'brand-2',
        name: 'Marca Dos',
        normalizedName: 'marca dos',
        status: 'INACTIVE',
      },
    ]);

    expect(model.active).toBe(1);
    expect(model.inactive).toBe(1);
    expect(model.protectedByGovernance).toBe(2);

    for (const item of model.items) {
      expect(item.manualVerifiedProtected).toBe(true);
      expect(item.requiresGovernedMutation).toBe(true);
      expect(item.canMutateCanonicalIdentityFromPresentation).toBe(false);
      expect(item.reviewBoundaryLabel).toBe('Unified Human Review Queue');
      expect(item.mutationBoundaryLabel).toBe(
        'Existing Control Plane requerido',
      );
    }
  });
});
