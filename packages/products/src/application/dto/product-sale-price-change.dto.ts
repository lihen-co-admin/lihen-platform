export interface ProductSalePriceChangeDTO {
  readonly id: string;
  readonly productId: string;
  readonly previousPrice: { readonly amount: number; readonly currency: string };
  readonly newPrice: { readonly amount: number; readonly currency: string };
  readonly reason: string;
  readonly actorId: string;
  readonly changedAt: string;
}
