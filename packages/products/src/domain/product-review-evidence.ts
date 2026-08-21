export type IdentityEvidenceProposal =
  | 'DISTINCT_PRODUCTS'
  | 'DUPLICATE_REFERENCE'
  | 'VARIANT_SET'
  | 'DEFER';

export type CandidateEvidenceProposal =
  | 'APPROVE_CREATE'
  | 'WAIT_IDENTITY_RESOLUTION'
  | 'DEFER';

export interface ProductIdentityEvidenceProposal {
  identityKey: string;
  memberCount: number;
  proposal: IdentityEvidenceProposal;
  confidence: number;
  requiresHumanApproval: true;
}

export interface ProductCandidateEvidenceProposal {
  sourceReferenceId: string;
  proposal: CandidateEvidenceProposal;
  confidence: number;
  requiresHumanApproval: true;
}

export function canAutoApplyEvidenceProposal(): false {
  return false;
}
