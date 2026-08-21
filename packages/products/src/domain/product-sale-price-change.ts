import { Money } from '@lihen/shared';

export interface ProductSalePriceChangeProps {
  readonly id: string;
  readonly productId: string;
  readonly previousPrice: Money;
  readonly newPrice: Money;
  readonly reason: string;
  readonly actorId: string;
  readonly changedAt: Date;
}

export class ProductSalePriceChange {
  public readonly id: string;
  public readonly productId: string;
  public readonly previousPrice: Money;
  public readonly newPrice: Money;
  public readonly reason: string;
  public readonly actorId: string;
  public readonly changedAt: Date;

  public constructor(props: ProductSalePriceChangeProps) {
    const reason = props.reason.trim();
    if (!reason) {
      throw new Error('Price change reason is required.');
    }

    this.id = props.id;
    this.productId = props.productId;
    this.previousPrice = props.previousPrice;
    this.newPrice = props.newPrice;
    this.reason = reason;
    this.actorId = props.actorId;
    this.changedAt = new Date(props.changedAt);
  }
}
