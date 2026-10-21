/** Reversible application scope only. Never filters or deletes canonical history/stock. */
export const PRODUCT_PILOTS = [
  { id: 'd519d93f-04ee-e454-3461-f11ce9ac19f1', sku: 'BC-20550', businessLine: 'BEAUTY_CARE' },
  { id: '9969ebfc-d7ff-475f-a031-65adc671e34e', sku: 'ST-019', businessLine: 'STYLE' },
] as const;
export const DEV_SUPABASE_ORIGIN = 'https://vnmkupzptujtywnnabkp.supabase.co';
export function isPilotProduct(product: {
  id: string;
  sku?: string | null | undefined;
  businessLine: string;
}) {
  return PRODUCT_PILOTS.some(
    (pilot) =>
      pilot.id === product.id &&
      pilot.sku === product.sku &&
      pilot.businessLine === product.businessLine,
  );
}
export function isPilotProductId(id: string) {
  return PRODUCT_PILOTS.some((pilot) => pilot.id === id);
}
export function pilotScopeEnabled(env: Record<string, unknown>) {
  return env.VITE_PRODUCT_PILOT_MODE === 'controlled';
}
