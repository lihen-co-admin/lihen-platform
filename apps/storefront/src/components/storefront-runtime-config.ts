export interface StorefrontRuntimeConfig {
  url: string;
  publishableKey: string;
}

const devFallback: StorefrontRuntimeConfig = {
  url: 'https://vnmkupzptujtywnnabkp.supabase.co',
  publishableKey: 'sb_publishable_E03kLaIYYbTgn6c6rBR52Q_iAaWTwr4',
};

export function getStorefrontRuntimeConfig(): StorefrontRuntimeConfig {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (url && publishableKey) return { url, publishableKey };
  if (import.meta.env.DEV) return devFallback;

  throw new Error('Storefront release configuration is missing. Define VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}
