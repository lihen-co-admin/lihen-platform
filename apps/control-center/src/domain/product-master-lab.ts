import type { ProductImageDTO, ProductVariantAttributes } from '@lihen/products';
import { z } from 'zod';
import { mediaForVariant, type VariantEvidence, type VariantMedia } from './product-variant-demand';

/** Local rehearsal only. This module has no repository or remote write capability. */
export const MASTER_FIELDS = [
  'name',
  'brand',
  'manufacturer',
  'reference',
  'gtin',
  'variant',
  'description',
  'supplier',
] as const;
export type MasterField = (typeof MASTER_FIELDS)[number];
export interface IdentityProposal {
  productId: string;
  baseline: string;
  values: Record<MasterField, string>;
  sourceUrl: string;
  sourceKind: 'BRAND' | 'MANUFACTURER' | 'AUTHORIZED_DISTRIBUTOR';
  evidence: string;
  checkedAt: string;
  exactVariant: boolean;
  discardedVariants: string;
  reviewer: string;
}
export interface LocalReview {
  version: 1;
  proposal: IdentityProposal;
  status: 'PENDING' | 'APPROVED_REHEARSAL' | 'REJECTED';
  events: { at: string; action: string; reviewer: string }[];
}
export function publicHttps(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) &&
      !/(^|\.)(localhost|local|internal|test|invalid)$/.test(u.hostname)
    );
  } catch {
    return false;
  }
}
export function proposalIssues(p: IdentityProposal): string[] {
  const issues: string[] = [];
  if (!p.values.name.trim() || !p.values.brand.trim() || !p.values.variant.trim())
    issues.push('Completa nombre, marca y variante exacta.');
  if (!publicHttps(p.sourceUrl)) issues.push('Aporta una fuente pública HTTPS sin credenciales.');
  if (!p.evidence.trim()) issues.push('Registra la evidencia y sus discrepancias.');
  if (!p.exactVariant) issues.push('Confirma la variante con evidencia oficial.');
  if (!p.reviewer.trim()) issues.push('Identifica a la persona revisora del ensayo.');
  if (!Number.isFinite(Date.parse(p.checkedAt)) || Date.parse(p.checkedAt) > Date.now())
    issues.push('Registra una fecha de consulta válida.');
  if (p.values.gtin && !/^\d{8}$|^\d{12,14}$/.test(p.values.gtin))
    issues.push('El GTIN debe transcribirse desde evidencia; revisa su formato.');
  return issues;
}
export function reviewProposal(
  p: IdentityProposal,
  approved: boolean,
  previous?: LocalReview,
): LocalReview {
  if (approved && proposalIssues(p).length) throw new Error('EVIDENCE_REQUIRED');
  return {
    version: 1,
    proposal: structuredClone(p),
    status: approved ? 'APPROVED_REHEARSAL' : 'REJECTED',
    events: [
      ...(previous?.events ?? []),
      {
        at: new Date().toISOString(),
        action: approved ? 'APPROVED_REHEARSAL' : 'REJECTED',
        reviewer: p.reviewer,
      },
    ],
  };
}
/** Imported decisions always return to review. A file is never an approval credential. */
export function recoverReview(text: string, productId: string, baseline: string): LocalReview {
  if (text.length > 100_000) throw new Error('FILE_TOO_LARGE');
  const raw = JSON.parse(text) as LocalReview;
  const p = raw?.proposal;
  if (
    raw.version !== 1 ||
    !p ||
    p.productId !== productId ||
    p.baseline !== baseline ||
    !p.values ||
    MASTER_FIELDS.some((k) => typeof p.values[k] !== 'string' || p.values[k].length > 10000) ||
    ['sourceUrl', 'evidence', 'checkedAt', 'discardedVariants', 'reviewer'].some(
      (k) => typeof (p as unknown as Record<string, unknown>)[k] !== 'string',
    ) ||
    !['BRAND', 'MANUFACTURER', 'AUTHORIZED_DISTRIBUTOR'].includes(p.sourceKind) ||
    typeof p.exactVariant !== 'boolean'
  )
    throw new Error('INVALID_OR_STALE_REVIEW');
  return {
    version: 1,
    proposal: p,
    status: 'PENDING',
    events: [
      { at: new Date().toISOString(), action: 'RECOVERED_REQUIRES_REVIEW', reviewer: p.reviewer },
    ],
  };
}
export function identityBaseline(product: {
  id: string;
  name: string;
  sku: string | null;
  businessLine: string;
}): string {
  return JSON.stringify([product.id, product.name, product.sku, product.businessLine]);
}

export type CommercialNameSourceKind = IdentityProposal['sourceKind'] | 'DEV_PRIVATE';
export interface CommercialNameEvidence {
  id: string;
  productId: string;
  candidateName: string;
  sourceKind: CommercialNameSourceKind;
  sourceUrl: string;
  excerpt: string;
  checkedAt: string;
  resolvesConflictIds: readonly string[];
}
export interface CommercialNameProposal extends Pick<
  IdentityProposal,
  'productId' | 'baseline' | 'evidence' | 'sourceUrl' | 'checkedAt' | 'reviewer'
> {
  currentName: string;
  candidateName: string | null;
  sourceKind: CommercialNameSourceKind;
  evidenceRecords: readonly CommercialNameEvidence[];
  identificationConflicts: readonly {
    id: string;
    description: string;
    resolutionEvidenceIds: readonly string[];
    resolvedBy: string | null;
    resolvedAt: string | null;
  }[];
}
export type CommercialNameReview = Omit<LocalReview, 'proposal'> & {
  proposal: CommercialNameProposal;
};
type CurrentNameProduct = Parameters<typeof identityBaseline>[0];

const nameSource = z.enum(['BRAND', 'MANUFACTURER', 'AUTHORIZED_DISTRIBUTOR', 'DEV_PRIVATE']);
const text = z.string().max(4000);
const candidateBundleSchema = z
  .object({
    productId: text,
    baseline: text,
    nameProposal: z
      .object({
        productId: text,
        baseline: text,
        currentName: text,
        candidateName: text.nullable(),
        evidence: text,
        sourceUrl: text,
        sourceKind: nameSource,
        checkedAt: text,
        reviewer: text,
        evidenceRecords: z
          .array(
            z.object({
              id: text,
              productId: text,
              candidateName: text,
              sourceKind: nameSource,
              sourceUrl: text,
              excerpt: text,
              checkedAt: text,
              resolvesConflictIds: z.array(text).max(100),
            }),
          )
          .max(100),
        identificationConflicts: z
          .array(
            z.object({
              id: text,
              description: text,
              resolutionEvidenceIds: z.array(text).max(100),
              resolvedBy: text.nullable(),
              resolvedAt: text.nullable(),
            }),
          )
          .max(100),
      })
      .nullable(),
    variants: z
      .array(
        z.object({
          familyProductId: text,
          sourceVariantId: text.min(1),
          sourceUrl: text,
          code: text.nullable(),
          status: z.enum(['OFFICIAL_SOURCE', 'PROBABLE', 'UNCONFIRMED']),
          attributes: z
            .object({
              size: text.optional(),
              sizeRange: text.optional(),
              color: text.optional(),
              tone: text.optional(),
              presentation: text.optional(),
              quantity: z.number().finite().optional(),
              unit: text.optional(),
              material: text.optional(),
              packCount: z.number().finite().optional(),
              pieceCount: z.number().finite().optional(),
              styleAttributes: z
                .record(z.string(), z.union([text, z.number().finite(), z.boolean()]))
                .optional(),
            })
            .strict(),
        }),
      )
      .max(100),
    variantMedia: z
      .array(
        z.object({
          familyProductId: text,
          variantId: text,
          id: text,
          imageUrl: text,
          rights: z.enum(['VERIFIED', 'UNVERIFIED']),
          exactMatch: z.boolean(),
        }),
      )
      .max(100),
    imageRoleProposals: z
      .array(
        z.object({
          imageId: text,
          role: z.enum(['CATALOG_PRIMARY', 'WEB_PRIMARY', 'GALLERY', 'GROUP_PHOTO', 'VARIANT']),
          variantId: text.nullable(),
          evidence: text.min(1),
        }),
      )
      .max(100),
  })
  .strict();

export interface ProductMasterCandidates {
  productId: string;
  baseline: string;
  nameReview: CommercialNameReview | null;
  variants: readonly VariantEvidence[];
  variantMedia: readonly VariantMedia[];
  imageRoleProposals: z.infer<typeof candidateBundleSchema>['imageRoleProposals'];
}

/** Explicit local intake only. Imported decisions never confer approval or verified rights. */
export function recoverProductMasterCandidates(
  raw: string,
  current: CurrentNameProduct,
  images: readonly ProductImageDTO[],
): ProductMasterCandidates {
  if (raw.length > 100000) throw new Error('CANDIDATE_INPUT_LIMIT');
  const input = candidateBundleSchema.parse(JSON.parse(raw));
  if (input.productId !== current.id || input.baseline !== identityBaseline(current))
    throw new Error('CANDIDATE_BASELINE_STALE');
  const name = input.nameProposal;
  if (current.sku === 'BC-20550' && name && !name.identificationConflicts.length)
    throw new Error('CANDIDATE_IDENTITY_CONFLICT_REQUIRED');
  if (
    name &&
    (name.productId !== current.id ||
      name.baseline !== input.baseline ||
      name.currentName !== current.name ||
      name.evidenceRecords.some((record) => record.productId !== current.id))
  )
    throw new Error('CANDIDATE_NAME_SCOPE');
  const sourceValid = (url: string) =>
    publicHttps(url) && !new URL(url).search && !new URL(url).hash;
  if (
    input.variants.some(
      (variant, index) =>
        variant.familyProductId !== current.id ||
        !sourceValid(variant.sourceUrl) ||
        input.variants.findIndex((item) => item.sourceVariantId === variant.sourceVariantId) !==
          index,
    )
  )
    throw new Error('CANDIDATE_VARIANT_SCOPE');
  const ownsImage = (id: string, url?: string) =>
    images.filter(
      (image) =>
        image.productId === current.id &&
        image.id === id &&
        (url === undefined || image.publicUrl === url),
    ).length === 1;
  if (
    input.variantMedia.some(
      (image) =>
        image.familyProductId !== current.id ||
        !ownsImage(image.id, image.imageUrl) ||
        !input.variants.some((variant) => variant.sourceVariantId === image.variantId),
    )
  )
    throw new Error('CANDIDATE_MEDIA_SCOPE');
  if (
    input.imageRoleProposals.some(
      (role) =>
        !ownsImage(role.imageId) ||
        !role.evidence.trim() ||
        (role.role === 'VARIANT'
          ? !input.variantMedia.some(
              (image) => image.id === role.imageId && image.variantId === role.variantId,
            )
          : role.variantId !== null),
    )
  )
    throw new Error('CANDIDATE_ROLE_SCOPE');
  return structuredClone({
    productId: input.productId,
    baseline: input.baseline,
    nameReview: name ? { version: 1, proposal: name, status: 'PENDING', events: [] } : null,
    variants: input.variants.map((variant) => ({
      ...variant,
      attributes: Object.fromEntries(
        Object.entries(variant.attributes).filter(([, value]) => value !== undefined),
      ) as ProductVariantAttributes,
    })),
    variantMedia: input.variantMedia.map((image) => ({
      ...image,
      rights: 'UNVERIFIED' as const,
      exactMatch: false,
    })),
    imageRoleProposals: input.imageRoleProposals,
  });
}

export function exportProductMasterCandidates(candidates: ProductMasterCandidates) {
  return structuredClone({
    productId: candidates.productId,
    baseline: candidates.baseline,
    nameProposal: candidates.nameReview?.proposal ?? null,
    variants: candidates.variants,
    variantMedia: candidates.variantMedia,
    imageRoleProposals: candidates.imageRoleProposals,
  });
}

/** A locator is traceable here, not fetched or certified by this local domain. */
function commercialNameSourceValid(
  kind: CommercialNameSourceKind,
  value: string,
  productId: string,
) {
  try {
    const url = new URL(value);
    if (
      url.username ||
      url.password ||
      url.hash ||
      [...url.searchParams.keys()].some((key) =>
        /token|key|signature|authorization|credential/i.test(key),
      )
    )
      return false;
    if (kind !== 'DEV_PRIVATE')
      return (
        ['BRAND', 'MANUFACTURER', 'AUTHORIZED_DISTRIBUTOR'].includes(kind) && publicHttps(value)
      );
    const parts = url.pathname.split('/').filter(Boolean);
    return (
      url.origin === 'https://vnmkupzptujtywnnabkp.supabase.co' &&
      !url.search &&
      parts.slice(0, 3).join('/') === 'storage/v1/object' &&
      ['public', 'authenticated'].includes(parts[3] ?? '') &&
      ['lihen-product-originals', 'lihen-product-web'].includes(parts[4] ?? '') &&
      parts[5] === 'products' &&
      parts[6] === productId &&
      parts.length > 7
    );
  } catch {
    return false;
  }
}

/** Eligibility is independent of human approval, media rights and variant approval. */
export function commercialNameProposalIssues(
  p: CommercialNameProposal,
  current: CurrentNameProduct,
): string[] {
  const issues: string[] = [];
  const validTime = (value: string) =>
    Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now();
  if (
    p.productId !== current.id ||
    p.currentName !== current.name ||
    p.baseline !== identityBaseline(current)
  )
    issues.push('NAME_BASELINE_STALE');
  if (!p.currentName.trim() || !p.candidateName?.trim()) issues.push('NAME_REQUIRED');
  if (
    !p.evidence.trim() ||
    !validTime(p.checkedAt) ||
    !commercialNameSourceValid(p.sourceKind, p.sourceUrl, p.productId)
  )
    issues.push('NAME_EVIDENCE_REQUIRED');
  const records = new Map(p.evidenceRecords.map((record) => [record.id, record]));
  const validRecord = (record: CommercialNameEvidence) =>
    Boolean(record.id.trim()) &&
    record.productId === p.productId &&
    record.candidateName.trim() === p.candidateName?.trim() &&
    Boolean(record.excerpt.trim()) &&
    validTime(record.checkedAt) &&
    commercialNameSourceValid(record.sourceKind, record.sourceUrl, p.productId);
  if (
    !records.size ||
    records.size !== p.evidenceRecords.length ||
    !p.evidenceRecords.every(validRecord) ||
    !p.evidenceRecords.some(
      (record) => record.sourceKind === p.sourceKind && record.sourceUrl === p.sourceUrl,
    )
  )
    issues.push('NAME_EVIDENCE_UNTRACEABLE');
  const conflictIds = new Set(p.identificationConflicts.map((conflict) => conflict.id));
  if (
    conflictIds.size !== p.identificationConflicts.length ||
    p.identificationConflicts.some(
      (conflict) =>
        !conflict.id.trim() ||
        !conflict.description.trim() ||
        !conflict.resolvedBy?.trim() ||
        !conflict.resolvedAt ||
        !validTime(conflict.resolvedAt) ||
        !conflict.resolutionEvidenceIds.length ||
        conflict.resolutionEvidenceIds.some((id) => {
          const record = records.get(id);
          return (
            !record ||
            !validRecord(record) ||
            !record.resolvesConflictIds.includes(conflict.id) ||
            Date.parse(record.checkedAt) > Date.parse(conflict.resolvedAt!)
          );
        }),
    )
  )
    issues.push('NAME_CONFLICT_UNRESOLVED');
  return issues;
}
export function canApproveCommercialName(
  p: CommercialNameProposal,
  current: CurrentNameProduct,
): boolean {
  return commercialNameProposalIssues(p, current).length === 0;
}

/** Explicit local decision only; never applies a name or approves images/variants. */
export function reviewCommercialNameProposal(
  p: CommercialNameProposal,
  current: CurrentNameProduct,
  approved: boolean,
  reviewer: string,
): CommercialNameReview {
  if (!reviewer.trim()) throw new Error('NAME_HUMAN_REVIEW_REQUIRED');
  if (approved && !canApproveCommercialName(p, current))
    throw new Error('NAME_PROPOSAL_NOT_ELIGIBLE');
  const status = approved ? ('APPROVED_REHEARSAL' as const) : ('REJECTED' as const);
  return {
    version: 1,
    proposal: { ...structuredClone(p), reviewer: reviewer.trim() },
    status,
    events: [{ at: new Date().toISOString(), action: status, reviewer: reviewer.trim() }],
  };
}

/** Read-only candidate projection. Source labels and historical decisions are not approvals. */
export function buildProductMasterProjection(
  product: CurrentNameProduct,
  input: {
    nameReview: CommercialNameReview | null;
    variants: readonly VariantEvidence[];
    variantMedia: readonly VariantMedia[];
    images: readonly ProductImageDTO[];
  },
) {
  const blockers = new Set<string>(['VISUAL_PROVENANCE_UNCONFIRMED', 'IMAGE_ROLES_PENDING']);
  const ownReview =
    input.nameReview &&
    input.nameReview.proposal.productId === product.id &&
    input.nameReview.proposal.evidenceRecords.every((record) => record.productId === product.id)
      ? input.nameReview
      : null;
  const nameIssues = ownReview
    ? commercialNameProposalIssues(ownReview.proposal, product)
    : [input.nameReview ? 'NAME_REVIEW_PRODUCT_MISMATCH' : 'NAME_PROPOSAL_MISSING'];
  nameIssues.forEach((issue) => blockers.add(issue));
  if (!ownReview || nameIssues.length) blockers.add('IDENTITY_REVIEW_PENDING');
  const images = input.images.filter((image) => image.productId === product.id);
  const evidence = input.variants.filter((variant) => variant.familyProductId === product.id);
  const media = input.variantMedia.filter((image) => image.familyProductId === product.id);
  if (
    images.length !== input.images.length ||
    evidence.length !== input.variants.length ||
    media.length !== input.variantMedia.length ||
    (input.nameReview && !ownReview)
  ) {
    blockers.add('FOREIGN_PRODUCT_REFERENCES_IGNORED');
  }
  if (!evidence.length) blockers.add('VARIANT_REFERENCES_PENDING');
  const linked = new Set<VariantMedia>();
  const variants = evidence.map((variant) => {
    const uncertainties: string[] = ['VARIANT_REVIEW_PENDING'];
    const uniqueVariant =
      Boolean(variant.sourceVariantId.trim()) &&
      evidence.filter((item) => item.sourceVariantId === variant.sourceVariantId).length === 1;
    if (!uniqueVariant) uncertainties.push('VARIANT_REFERENCE_AMBIGUOUS');
    if (variant.status !== 'OFFICIAL_SOURCE') uncertainties.push('VARIANT_SOURCE_UNCONFIRMED');
    const variantImages = uniqueVariant
      ? mediaForVariant(
          { familyProductId: product.id, variantId: variant.sourceVariantId },
          media,
        ).filter((reference) => {
          const matches = images.filter((image) => image.id === reference.id);
          const valid =
            matches.length === 1 &&
            Boolean(reference.id.trim()) &&
            reference.imageUrl === matches[0]!.publicUrl;
          if (valid) linked.add(reference);
          return valid;
        })
      : [];
    if (!variantImages.length) uncertainties.push('VARIANT_IMAGE_LINK_PENDING');
    if (variantImages.some((image) => !image.exactMatch))
      uncertainties.push('VARIANT_IDENTITY_UNCONFIRMED');
    if (variantImages.some((image) => image.rights !== 'VERIFIED'))
      uncertainties.push('VARIANT_IMAGE_RIGHTS_UNCONFIRMED');
    uncertainties.forEach((issue) => blockers.add(issue));
    return {
      evidence: variant,
      images: variantImages,
      reviewStatus: 'PENDING' as const,
      uncertainties,
    };
  });
  const unlinkedVariantMedia = media.filter((image) => !linked.has(image));
  if (unlinkedVariantMedia.length) blockers.add('VARIANT_MEDIA_LINK_UNRESOLVED');
  return structuredClone({
    product,
    name: {
      currentName: product.name,
      recordedReview: ownReview,
      eligibilityIssues: nameIssues,
      eligible: nameIssues.length === 0,
      applied: false as const,
    },
    variants,
    unlinkedVariantMedia,
    images: {
      references: images,
      reviewStatus: 'PENDING' as const,
      roles: {
        catalogPrimary: null as string | null,
        webPrimary: null as string | null,
        gallery: [] as string[],
        groupPhoto: [] as string[],
        byVariant: {} as Record<string, string[]>,
      },
    },
    blockers: [...blockers],
  });
}
