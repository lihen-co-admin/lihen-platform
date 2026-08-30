import { describe, expect, it } from 'vitest';
import {
  assessVisualExperienceReadiness,
  blankVisualExperienceEvidence,
  type VisualExperienceEvidence,
  type VisualExperienceSurface,
} from '../src/domain/visual-experience-readiness';

const completeEvidence: VisualExperienceEvidence = {
  sourceMapped: true,
  existingPatternsMapped: true,
  functionalInvariantsConfirmed: true,
  responsiveBaselineConfirmed: true,
  accessibilityBaselineConfirmed: true,
  feedbackStatesBaselineConfirmed: true,
  performanceBaselineConfirmed: true,
};

describe('visual experience readiness', () => {
  it.each<VisualExperienceSurface>(['CONTROL_CENTER', 'STOREFRONT'])(
    'keeps %s held until source evidence is complete',
    (surface) => {
      const result = assessVisualExperienceReadiness(
        surface,
        blankVisualExperienceEvidence(),
      );

      expect(result.readiness).toBe('SOURCE_EVIDENCE_INCOMPLETE');
      expect(result.mayRefineVisualLayer).toBe(false);
      expect(result.missingEvidence).toHaveLength(7);
    },
  );

  it.each<VisualExperienceSurface>(['CONTROL_CENTER', 'STOREFRONT'])(
    'allows %s visual refinement only after complete evidence',
    (surface) => {
      const result = assessVisualExperienceReadiness(surface, completeEvidence);

      expect(result.readiness).toBe('READY_TO_REFINE');
      expect(result.mayRefineVisualLayer).toBe(true);
      expect(result.missingEvidence).toEqual([]);
      expect(result.businessLogicMustRemainUntouched).toBe(true);
      expect(result.governanceMustRemainUntouched).toBe(true);
    },
  );

  it.each<VisualExperienceSurface>(['CONTROL_CENTER', 'STOREFRONT'])(
    'blocks %s when functional risk is detected even with complete evidence',
    (surface) => {
      const result = assessVisualExperienceReadiness(
        surface,
        completeEvidence,
        true,
      );

      expect(result.readiness).toBe('BLOCKED_BY_FUNCTIONAL_RISK');
      expect(result.mayRefineVisualLayer).toBe(false);
    },
  );

  it('reports the exact missing evidence instead of using a score', () => {
    const result = assessVisualExperienceReadiness('CONTROL_CENTER', {
      ...completeEvidence,
      accessibilityBaselineConfirmed: false,
      performanceBaselineConfirmed: false,
    });

    expect(result.missingEvidence).toEqual([
      'accessibilityBaselineConfirmed',
      'performanceBaselineConfirmed',
    ]);
  });
});
