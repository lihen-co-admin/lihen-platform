export const READY_CANDIDATE_CANONICAL_APPROVAL_POLICY_V1 =
  "READY_CANDIDATE_CANONICAL_APPROVAL_V1" as const;

export type CanonicalApprovalSource = "HUMAN_APPROVED" | "POLICY_APPROVED";

export interface ReadyCandidateApprovalPolicyGate {
  candidateStatus: "READY_CANDIDATE";
  businessLine: "BEAUTY_CARE" | "STYLE";
  hasHumanDecision: false;
  validImageSha256: true;
  hasTaxonomyAnchor: true;
  categoryBusinessLineMatches: true;
  uniqueIdentityAcrossCandidateRun: true;
  catalogAuditReviewRequired: false;
}

export interface CanonicalProductApproval {
  sourceReferenceId: string;
  businessLine: "BEAUTY_CARE" | "STYLE";
  approvalSource: CanonicalApprovalSource;
  productWriteAllowed: false;
}

export function qualifiesForReadyCandidatePolicy(
  gate: ReadyCandidateApprovalPolicyGate,
): boolean {
  return (
    gate.candidateStatus === "READY_CANDIDATE" &&
    gate.hasHumanDecision === false &&
    gate.validImageSha256 === true &&
    gate.hasTaxonomyAnchor === true &&
    gate.categoryBusinessLineMatches === true &&
    gate.uniqueIdentityAcrossCandidateRun === true &&
    gate.catalogAuditReviewRequired === false
  );
}
