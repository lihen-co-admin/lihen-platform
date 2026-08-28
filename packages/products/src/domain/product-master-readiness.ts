import type { BusinessLine } from './business-line';
import type { ProductStatus } from './product-status';
import type { BrandStatus } from './brand';
import type { CategoryStatus } from './category';

export type ProductMasterIdentityStatus = 'READY' | 'INCOMPLETE' | 'INVALID';
export type ProductMasterLifecycleStatus = 'OFFERABLE' | 'NOT_OFFERABLE';

export type ProductMasterReadinessIssue =
  | 'BRAND_REQUIRED'
  | 'CATEGORY_REQUIRED'
  | 'BRAND_INACTIVE'
  | 'CATEGORY_INACTIVE'
  | 'CATEGORY_BUSINESS_LINE_MISMATCH';

export interface ProductMasterReadinessInput {
  readonly businessLine: BusinessLine;
  readonly brandId?: string;
  readonly brandStatus?: BrandStatus;
  readonly categoryId?: string;
  readonly categoryStatus?: CategoryStatus;
  readonly categoryBusinessLine?: BusinessLine;
  readonly status: ProductStatus;
}

export interface ProductMasterReadiness {
  readonly identityStatus: ProductMasterIdentityStatus;
  readonly lifecycleStatus: ProductMasterLifecycleStatus;
  readonly issues: readonly ProductMasterReadinessIssue[];
}

/**
 * Evaluates only Product Master consistency.
 *
 * This does not decide catalog/storefront publication. Media, price, catalog
 * snapshot and publishing gates remain separate concerns.
 */
export function evaluateProductMasterReadiness(
  input: ProductMasterReadinessInput,
): ProductMasterReadiness {
  const issues: ProductMasterReadinessIssue[] = [];

  if (!input.brandId) issues.push('BRAND_REQUIRED');
  else if (input.brandStatus === 'INACTIVE') issues.push('BRAND_INACTIVE');

  if (!input.categoryId) issues.push('CATEGORY_REQUIRED');
  else {
    if (input.categoryStatus === 'INACTIVE') issues.push('CATEGORY_INACTIVE');
    if (
      input.categoryBusinessLine !== undefined
      && input.categoryBusinessLine !== input.businessLine
    ) {
      issues.push('CATEGORY_BUSINESS_LINE_MISMATCH');
    }
  }

  const invalid = issues.includes('CATEGORY_BUSINESS_LINE_MISMATCH');

  return {
    identityStatus: invalid ? 'INVALID' : issues.length > 0 ? 'INCOMPLETE' : 'READY',
    lifecycleStatus: input.status === 'ACTIVE' ? 'OFFERABLE' : 'NOT_OFFERABLE',
    issues,
  };
}
