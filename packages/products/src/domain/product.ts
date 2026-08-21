import { Money } from '@lihen/shared';
import type { ProductStatus } from './product-status';
import type { BusinessLine } from './business-line';

export interface ProductProps {
  readonly id: string;
  readonly sku?: string;
  readonly catalogCode?: string;
  readonly slug?: string;
  readonly name: string;
  readonly businessLine: BusinessLine;
  readonly brandId?: string;
  readonly categoryId?: string;
  readonly status: ProductStatus;
  readonly salePrice: Money;
}

export class Product {
  public readonly id: string;
  public readonly sku: string | undefined;
  public readonly catalogCode: string | undefined;
  public readonly slug: string;
  public readonly name: string;
  public readonly businessLine: BusinessLine;
  public readonly brandId: string | undefined;
  public readonly categoryId: string | undefined;
  public readonly status: ProductStatus;
  public readonly salePrice: Money;

  public constructor(props: ProductProps) {
    if (!props.name.trim()) throw new Error('Product name is required.');
    this.id = props.id;
    this.sku = props.sku;
    this.catalogCode = props.catalogCode;
    this.slug = (props.slug?.trim() || props.name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || `product-${props.id}`);
    this.name = props.name.trim();
    this.businessLine = props.businessLine;
    this.brandId = props.brandId;
    this.categoryId = props.categoryId;
    this.status = props.status;
    this.salePrice = props.salePrice;
  }
}
