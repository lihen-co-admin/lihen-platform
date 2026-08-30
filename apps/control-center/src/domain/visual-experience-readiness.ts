export type VisualExperienceSurface =
  | 'CONTROL_CENTER'
  | 'STOREFRONT';

export type VisualExperienceConcern =
  | 'VISUAL_HIERARCHY'
  | 'NAVIGATION'
  | 'RESPONSIVE'
  | 'ACCESSIBILITY'
  | 'FEEDBACK_STATES'
  | 'PERCEIVED_PERFORMANCE'
  | 'BRAND_CONSISTENCY';

export type VisualExperienceReadiness =
  | 'READY_TO_REFINE'
  | 'SOURCE_EVIDENCE_INCOMPLETE'
  | 'BLOCKED_BY_FUNCTIONAL_RISK';

export interface VisualExperienceEvidence {
  readonly sourceMapped: boolean;
  readonly existingPatternsMapped: boolean;
  readonly functionalInvariantsConfirmed: boolean;
  readonly responsiveBaselineConfirmed: boolean;
  readonly accessibilityBaselineConfirmed: boolean;
  readonly feedbackStatesBaselineConfirmed: boolean;
  readonly performanceBaselineConfirmed: boolean;
}

export interface VisualExperienceAssessment {
  readonly surface: VisualExperienceSurface;
  readonly readiness: VisualExperienceReadiness;
  readonly missingEvidence: readonly (keyof VisualExperienceEvidence)[];
  readonly mayRefineVisualLayer: boolean;
  readonly businessLogicMustRemainUntouched: true;
  readonly governanceMustRemainUntouched: true;
}

const EVIDENCE_KEYS: readonly (keyof VisualExperienceEvidence)[] = [
  'sourceMapped',
  'existingPatternsMapped',
  'functionalInvariantsConfirmed',
  'responsiveBaselineConfirmed',
  'accessibilityBaselineConfirmed',
  'feedbackStatesBaselineConfirmed',
  'performanceBaselineConfirmed',
];

export function assessVisualExperienceReadiness(
  surface: VisualExperienceSurface,
  evidence: VisualExperienceEvidence,
  functionalRiskDetected = false,
): VisualExperienceAssessment {
  const missingEvidence = EVIDENCE_KEYS.filter((key) => !evidence[key]);

  if (functionalRiskDetected) {
    return {
      surface,
      readiness: 'BLOCKED_BY_FUNCTIONAL_RISK',
      missingEvidence,
      mayRefineVisualLayer: false,
      businessLogicMustRemainUntouched: true,
      governanceMustRemainUntouched: true,
    };
  }

  return {
    surface,
    readiness:
      missingEvidence.length === 0
        ? 'READY_TO_REFINE'
        : 'SOURCE_EVIDENCE_INCOMPLETE',
    missingEvidence,
    mayRefineVisualLayer: missingEvidence.length === 0,
    businessLogicMustRemainUntouched: true,
    governanceMustRemainUntouched: true,
  };
}

export function blankVisualExperienceEvidence(): VisualExperienceEvidence {
  return {
    sourceMapped: false,
    existingPatternsMapped: false,
    functionalInvariantsConfirmed: false,
    responsiveBaselineConfirmed: false,
    accessibilityBaselineConfirmed: false,
    feedbackStatesBaselineConfirmed: false,
    performanceBaselineConfirmed: false,
  };
}
