import { z } from 'zod';

export const productReadSourceSchema = z.enum(['memory', 'supabase']);
export type ProductReadSource = z.infer<typeof productReadSourceSchema>;
export const authModeSchema = z.enum(['disabled', 'supabase']);
export const productWriteModeSchema = z.enum(['blocked', 'controlled']);
export const productReadModeSchema = z.enum(['blocked', 'controlled']);
export type ProductWriteMode = z.infer<typeof productWriteModeSchema>;
export type ProductReadMode = z.infer<typeof productReadModeSchema>;
export type AuthMode = z.infer<typeof authModeSchema>;

const booleanFromEnv = z.preprocess(
  (value) => value === true || value === 'true',
  z.boolean(),
);

export const browserEnvSchema = z.object({
  VITE_PRODUCT_READ_SOURCE: productReadSourceSchema.default('memory'),
  VITE_AUTH_MODE: authModeSchema.default('disabled'),
  VITE_PRODUCT_WRITE_MODE: productWriteModeSchema.default('blocked'),
  VITE_PRODUCT_UPDATE_WRITE_MODE: productWriteModeSchema.default('blocked'),
  VITE_PRODUCT_PRICE_WRITE_MODE: productWriteModeSchema.default('blocked'),
  VITE_PRODUCT_PRICE_HISTORY_READ_MODE: productReadModeSchema.default('blocked'),
  VITE_PRODUCT_IMAGES_READ_MODE: productReadModeSchema.default('blocked'),
  VITE_PRODUCT_IMAGE_WRITE_MODE: productWriteModeSchema.default('blocked'),
  VITE_PRODUCT_IMAGE_STORAGE_UPLOAD_MODE: productWriteModeSchema.default('blocked'),
  VITE_VISUAL_INTELLIGENCE_MODE: productWriteModeSchema.default('blocked'),
  VITE_PUBLIC_HUB_MODE: productWriteModeSchema.default('blocked'),
  VITE_INVENTORY_WRITE_MODE: productWriteModeSchema.default('blocked'),
  VITE_SUPPLIER_WRITE_MODE: productWriteModeSchema.default('blocked'),
  VITE_PURCHASE_WRITE_MODE: productWriteModeSchema.default('blocked'),
  VITE_ORDER_WRITE_MODE: productWriteModeSchema.default('blocked'),
  VITE_SALE_WRITE_MODE: productWriteModeSchema.default('blocked'),
  VITE_FINANCE_WRITE_MODE: productWriteModeSchema.default('blocked'),
  VITE_DEV_ALLOW_BOOTSTRAP_SIGNUP: booleanFromEnv.default(false),
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

export type BrowserEnv = z.infer<typeof browserEnvSchema>;

export function parseBrowserEnv(env: Record<string, unknown>): BrowserEnv {
  const parsed = browserEnvSchema.parse(env);

  if (parsed.VITE_PRODUCT_READ_SOURCE === 'supabase' || parsed.VITE_AUTH_MODE === 'supabase') {
    if (!parsed.VITE_SUPABASE_URL || !parsed.VITE_SUPABASE_PUBLISHABLE_KEY) {
      throw new Error(
        'Supabase DEV requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
      );
    }
  }

  if (parsed.VITE_PRODUCT_WRITE_MODE === 'controlled' && parsed.VITE_PRODUCT_READ_SOURCE !== 'supabase') {
    throw new Error('Controlled product writes require VITE_PRODUCT_READ_SOURCE=supabase.');
  }

  if (parsed.VITE_PRODUCT_WRITE_MODE === 'controlled' && parsed.VITE_AUTH_MODE !== 'supabase') {
    throw new Error('Controlled product writes require VITE_AUTH_MODE=supabase.');
  }

  if (parsed.VITE_PRODUCT_UPDATE_WRITE_MODE === 'controlled' && parsed.VITE_PRODUCT_READ_SOURCE !== 'supabase') {
    throw new Error('Controlled product updates require VITE_PRODUCT_READ_SOURCE=supabase.');
  }

  if (parsed.VITE_PRODUCT_UPDATE_WRITE_MODE === 'controlled' && parsed.VITE_AUTH_MODE !== 'supabase') {
    throw new Error('Controlled product updates require VITE_AUTH_MODE=supabase.');
  }

  if (parsed.VITE_PRODUCT_PRICE_WRITE_MODE === 'controlled' && parsed.VITE_PRODUCT_READ_SOURCE !== 'supabase') {
    throw new Error('Controlled product price changes require VITE_PRODUCT_READ_SOURCE=supabase.');
  }

  if (parsed.VITE_PRODUCT_PRICE_WRITE_MODE === 'controlled' && parsed.VITE_AUTH_MODE !== 'supabase') {
    throw new Error('Controlled product price changes require VITE_AUTH_MODE=supabase.');
  }


  if (parsed.VITE_PRODUCT_PRICE_HISTORY_READ_MODE === 'controlled' && parsed.VITE_PRODUCT_READ_SOURCE !== 'supabase') {
    throw new Error('Controlled product price-history reads require VITE_PRODUCT_READ_SOURCE=supabase.');
  }

  if (parsed.VITE_PRODUCT_PRICE_HISTORY_READ_MODE === 'controlled' && parsed.VITE_AUTH_MODE !== 'supabase') {
    throw new Error('Controlled product price-history reads require VITE_AUTH_MODE=supabase.');
  }


  if (parsed.VITE_PRODUCT_IMAGES_READ_MODE === 'controlled' && parsed.VITE_PRODUCT_READ_SOURCE !== 'supabase') {
    throw new Error('Controlled product-image reads require VITE_PRODUCT_READ_SOURCE=supabase.');
  }

  if (parsed.VITE_PRODUCT_IMAGES_READ_MODE === 'controlled' && parsed.VITE_AUTH_MODE !== 'supabase') {
    throw new Error('Controlled product-image reads require VITE_AUTH_MODE=supabase.');
  }


  if (parsed.VITE_PRODUCT_IMAGE_WRITE_MODE === 'controlled' && parsed.VITE_PRODUCT_READ_SOURCE !== 'supabase') {
    throw new Error('Controlled product-image writes require VITE_PRODUCT_READ_SOURCE=supabase.');
  }

  if (parsed.VITE_PRODUCT_IMAGE_WRITE_MODE === 'controlled' && parsed.VITE_AUTH_MODE !== 'supabase') {
    throw new Error('Controlled product-image writes require VITE_AUTH_MODE=supabase.');
  }

  if (parsed.VITE_PRODUCT_IMAGE_WRITE_MODE === 'controlled' && parsed.VITE_PRODUCT_IMAGES_READ_MODE !== 'controlled') {
    throw new Error('Controlled product-image writes require VITE_PRODUCT_IMAGES_READ_MODE=controlled.');
  }

  if (parsed.VITE_PRODUCT_IMAGE_STORAGE_UPLOAD_MODE === 'controlled' && parsed.VITE_PRODUCT_READ_SOURCE !== 'supabase') {
    throw new Error('Controlled product-image Storage uploads require VITE_PRODUCT_READ_SOURCE=supabase.');
  }

  if (parsed.VITE_PRODUCT_IMAGE_STORAGE_UPLOAD_MODE === 'controlled' && parsed.VITE_AUTH_MODE !== 'supabase') {
    throw new Error('Controlled product-image Storage uploads require VITE_AUTH_MODE=supabase.');
  }

  if (parsed.VITE_PRODUCT_IMAGE_STORAGE_UPLOAD_MODE === 'controlled' && parsed.VITE_PRODUCT_IMAGE_WRITE_MODE !== 'controlled') {
    throw new Error('Controlled product-image Storage uploads require VITE_PRODUCT_IMAGE_WRITE_MODE=controlled.');
  }

  if (parsed.VITE_VISUAL_INTELLIGENCE_MODE === 'controlled' && parsed.VITE_PRODUCT_READ_SOURCE !== 'supabase') {
    throw new Error('Controlled Visual Intelligence requires VITE_PRODUCT_READ_SOURCE=supabase.');
  }

  if (parsed.VITE_VISUAL_INTELLIGENCE_MODE === 'controlled' && parsed.VITE_AUTH_MODE !== 'supabase') {
    throw new Error('Controlled Visual Intelligence requires VITE_AUTH_MODE=supabase.');
  }

  if (parsed.VITE_INVENTORY_WRITE_MODE === 'controlled' && parsed.VITE_PRODUCT_READ_SOURCE !== 'supabase') {
    throw new Error('Controlled inventory writes require VITE_PRODUCT_READ_SOURCE=supabase.');
  }

  if (parsed.VITE_INVENTORY_WRITE_MODE === 'controlled' && parsed.VITE_AUTH_MODE !== 'supabase') {
    throw new Error('Controlled inventory writes require VITE_AUTH_MODE=supabase.');
  }

  if (parsed.VITE_SUPPLIER_WRITE_MODE === 'controlled' && parsed.VITE_PRODUCT_READ_SOURCE !== 'supabase') {
    throw new Error('Controlled supplier writes require VITE_PRODUCT_READ_SOURCE=supabase.');
  }

  if (parsed.VITE_SUPPLIER_WRITE_MODE === 'controlled' && parsed.VITE_AUTH_MODE !== 'supabase') {
    throw new Error('Controlled supplier writes require VITE_AUTH_MODE=supabase.');
  }

  if (parsed.VITE_PURCHASE_WRITE_MODE === 'controlled' && parsed.VITE_PRODUCT_READ_SOURCE !== 'supabase') {
    throw new Error('Controlled purchase writes require VITE_PRODUCT_READ_SOURCE=supabase.');
  }

  if (parsed.VITE_PURCHASE_WRITE_MODE === 'controlled' && parsed.VITE_AUTH_MODE !== 'supabase') {
    throw new Error('Controlled purchase writes require VITE_AUTH_MODE=supabase.');
  }

  if (parsed.VITE_ORDER_WRITE_MODE === 'controlled' && parsed.VITE_PRODUCT_READ_SOURCE !== 'supabase') {
    throw new Error('Controlled order writes require VITE_PRODUCT_READ_SOURCE=supabase.');
  }

  if (parsed.VITE_ORDER_WRITE_MODE === 'controlled' && parsed.VITE_AUTH_MODE !== 'supabase') {
    throw new Error('Controlled order writes require VITE_AUTH_MODE=supabase.');
  }

  if (parsed.VITE_SALE_WRITE_MODE === 'controlled' && (parsed.VITE_PRODUCT_READ_SOURCE !== 'supabase' || parsed.VITE_AUTH_MODE !== 'supabase')) {
    throw new Error('Controlled sale writes require Supabase read source and auth.');
  }

  if (parsed.VITE_FINANCE_WRITE_MODE === 'controlled' && (parsed.VITE_PRODUCT_READ_SOURCE !== 'supabase' || parsed.VITE_AUTH_MODE !== 'supabase')) {
    throw new Error('Controlled finance writes require Supabase read source and auth.');
  }

  if (parsed.VITE_DEV_ALLOW_BOOTSTRAP_SIGNUP && parsed.VITE_AUTH_MODE !== 'supabase') {
    throw new Error('Bootstrap signup requires VITE_AUTH_MODE=supabase.');
  }

  return parsed;
}
