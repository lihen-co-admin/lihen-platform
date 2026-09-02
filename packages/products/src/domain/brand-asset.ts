export type BrandAssetKind =
  | 'LOGO'
  | 'WORDMARK'
  | 'ISOTYPE'
  | 'LOCKUP';

export type BrandAssetStatus = 'ACTIVE' | 'ARCHIVED';

export type BrandAssetApprovalMode =
  | 'MANUAL_VERIFIED'
  | 'AUTO_VERIFIED'
  | 'CANDIDATE'
  | 'REQUIRES_REVIEW';

export interface BrandAssetProps {
  readonly id: string;
  readonly brandId: string;
  readonly kind: BrandAssetKind;
  readonly publicUrl: string;
  readonly sourceUrl?: string;
  readonly storagePath?: string;
  readonly sha256?: string;
  readonly status?: BrandAssetStatus;
  readonly approvalMode?: BrandAssetApprovalMode;
  readonly confidence?: number;
  readonly approvedBy?: string;
  readonly approvedAt?: string;
  readonly isPrimary?: boolean;
  readonly sortOrder?: number;
}

export class BrandAsset {
  public readonly id: string;
  public readonly brandId: string;
  public readonly kind: BrandAssetKind;
  public readonly publicUrl: string;
  public readonly sourceUrl?: string;
  public readonly storagePath?: string;
  public readonly sha256?: string;
  public readonly status: BrandAssetStatus;
  public readonly approvalMode: BrandAssetApprovalMode;
  public readonly confidence?: number;
  public readonly approvedBy?: string;
  public readonly approvedAt?: string;
  public readonly isPrimary: boolean;
  public readonly sortOrder: number;

  public constructor(props: BrandAssetProps) {
    const id = props.id.trim();
    const brandId = props.brandId.trim();
    const publicUrl = props.publicUrl.trim();

    if (!id) throw new Error('Brand asset id is required.');
    if (!brandId) throw new Error('Brand asset brandId is required.');
    if (!publicUrl) throw new Error('Brand asset publicUrl is required.');

    const sortOrder = props.sortOrder ?? 0;
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      throw new Error('Brand asset sortOrder must be a non-negative integer.');
    }

    if (
      props.confidence !== undefined &&
      (!Number.isFinite(props.confidence) ||
        props.confidence < 0 ||
        props.confidence > 1)
    ) {
      throw new Error('Brand asset confidence must be between 0 and 1.');
    }

    const sha256 = props.sha256?.trim().toLowerCase();
    if (sha256 !== undefined && !/^[a-f0-9]{64}$/.test(sha256)) {
      throw new Error('Brand asset sha256 must be a 64-character hexadecimal value.');
    }

    this.id = id;
    this.brandId = brandId;
    this.kind = props.kind;
    this.publicUrl = publicUrl;
    if (props.sourceUrl?.trim()) this.sourceUrl = props.sourceUrl.trim();
    if (props.storagePath?.trim()) this.storagePath = props.storagePath.trim();
    if (sha256 !== undefined) this.sha256 = sha256;
    this.status = props.status ?? 'ACTIVE';
    this.approvalMode = props.approvalMode ?? 'REQUIRES_REVIEW';
    if (props.confidence !== undefined) this.confidence = props.confidence;
    if (props.approvedBy?.trim()) this.approvedBy = props.approvedBy.trim();
    if (props.approvedAt?.trim()) this.approvedAt = props.approvedAt.trim();
    this.isPrimary = props.isPrimary ?? false;
    this.sortOrder = sortOrder;
  }
}

function orderAssets(a: BrandAsset, b: BrandAsset): number {
  return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
}

/**
 * GAP-015 models canonical Brand Assets 1:N only.
 *
 * It does not search, verify, approve, replace manual-verified identity,
 * persist to Supabase, publish, or decide renderer/catalog behavior.
 */
export class BrandAssetSet {
  private readonly orderedAssets: readonly BrandAsset[];

  public constructor(
    public readonly brandId: string,
    assets: readonly BrandAsset[],
  ) {
    const normalizedBrandId = brandId.trim();
    if (!normalizedBrandId) {
      throw new Error('Brand asset set brandId is required.');
    }

    const ids = new Set<string>();
    const activePrimaryKinds = new Set<BrandAssetKind>();

    for (const asset of assets) {
      if (asset.brandId !== normalizedBrandId) {
        throw new Error('All Brand Assets in a set must belong to the same brandId.');
      }
      if (ids.has(asset.id)) {
        throw new Error(`Duplicate Brand Asset id: ${asset.id}.`);
      }
      ids.add(asset.id);

      if (asset.status === 'ACTIVE' && asset.isPrimary) {
        if (activePrimaryKinds.has(asset.kind)) {
          throw new Error(
            `Only one ACTIVE primary Brand Asset is allowed for kind ${asset.kind}.`,
          );
        }
        activePrimaryKinds.add(asset.kind);
      }
    }

    this.brandId = normalizedBrandId;
    this.orderedAssets = Object.freeze([...assets].sort(orderAssets));
  }

  public all(): readonly BrandAsset[] {
    return this.orderedAssets;
  }

  public active(): readonly BrandAsset[] {
    return this.orderedAssets.filter((asset) => asset.status === 'ACTIVE');
  }

  public archived(): readonly BrandAsset[] {
    return this.orderedAssets.filter((asset) => asset.status === 'ARCHIVED');
  }

  public byKind(kind: BrandAssetKind): readonly BrandAsset[] {
    return this.orderedAssets.filter((asset) => asset.kind === kind);
  }

  public primary(kind: BrandAssetKind): BrandAsset | undefined {
    return this.orderedAssets.find(
      (asset) =>
        asset.kind === kind &&
        asset.status === 'ACTIVE' &&
        asset.isPrimary,
    );
  }

  public size(): number {
    return this.orderedAssets.length;
  }

  public isEmpty(): boolean {
    return this.orderedAssets.length === 0;
  }
}
