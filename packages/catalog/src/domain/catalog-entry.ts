export interface CatalogEntry {
  readonly id: string;
  readonly catalogVersionId: string;
  readonly productId: string;
  readonly productNameSnapshot: string;
  readonly salePriceSnapshot: number;
  readonly visible: boolean;
  readonly sortOrder: number;
}
