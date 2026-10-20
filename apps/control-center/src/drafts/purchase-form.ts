/** UI strings; submit converts cost to CreatePurchaseDraftItemInput.quotedUnitCost. */
export interface PurchaseFormLine {
  readonly key: string;
  readonly productId: string;
  readonly quantity: string;
  readonly cost: string;
}

export function purchaseLinesHaveChanges(lines: readonly PurchaseFormLine[]): boolean {
  return (
    lines.length !== 1 ||
    lines.some((line) => Boolean(line.productId || line.quantity !== '1' || line.cost))
  );
}
