export const controlledCapabilities = {
  PRODUCT: 'VITE_PRODUCT_WRITE_MODE',
  PRODUCT_UPDATE: 'VITE_PRODUCT_UPDATE_WRITE_MODE',
  PRICE: 'VITE_PRODUCT_PRICE_WRITE_MODE',
  PRICE_HISTORY: 'VITE_PRODUCT_PRICE_HISTORY_READ_MODE',
  PRODUCT_IMAGES: 'VITE_PRODUCT_IMAGES_READ_MODE',
  PRODUCT_IMAGE_WRITE: 'VITE_PRODUCT_IMAGE_WRITE_MODE',
  INVENTORY: 'VITE_INVENTORY_WRITE_MODE',
  SUPPLIERS: 'VITE_SUPPLIER_WRITE_MODE',
  PURCHASES: 'VITE_PURCHASE_WRITE_MODE',
  ORDERS: 'VITE_ORDER_WRITE_MODE',
  SALES: 'VITE_SALE_WRITE_MODE',
  FINANCE: 'VITE_FINANCE_WRITE_MODE',
  HUB: 'VITE_PUBLIC_HUB_MODE',
  VISUAL_INTELLIGENCE: 'VITE_VISUAL_INTELLIGENCE_MODE',
} as const;

/** Configuration only: READY never attests deployment, permissions or connectivity. */
export function configurationReadiness(env: Record<string, unknown>) {
  const auth = env.VITE_AUTH_MODE === 'supabase' ? 'supabase' : 'disabled';
  const source = env.VITE_PRODUCT_READ_SOURCE === 'supabase' ? 'supabase' : 'memory';
  const credentialsPresent = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const durable = auth === 'supabase' && source === 'supabase' && credentialsPresent;
  return {
    auth, source, credentialsPresent,
    editorialSync: env.DEV === true && env.VITE_EDITORIAL_DEV_SYNC_ENABLED === 'true' && durable ? 'enabled' : 'disabled',
    capabilities: Object.entries(controlledCapabilities).map(([capability, variable]) => {
      const mode = env[variable] === 'controlled' ? 'controlled' : 'blocked';
      const imagesReady = capability !== 'PRODUCT_IMAGE_WRITE' || env.VITE_PRODUCT_IMAGES_READ_MODE === 'controlled';
      return { capability, variable, mode, status: mode === 'blocked' ? 'BLOCKED' : durable && imagesReady ? 'READY' : 'REVIEW' };
    }),
  };
}
