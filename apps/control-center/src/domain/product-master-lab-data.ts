import { useSyncExternalStore } from 'react';
import { z } from 'zod';
const image = z.object({
  id: z.string(),
  url: z.string().url(),
  alt: z.string(),
  isMain: z.boolean(),
  sourceType: z.string(),
  rightsApproved: z.literal(true),
});
const product = z.object({
  id: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  business_line: z.enum(['BEAUTY_CARE', 'STYLE']),
  brand: z.string().nullable().optional(),
  canonical_brand: z.string().nullable().optional(),
  description: z.string().optional(),
  category: z.string().nullable().optional(),
  sale_price: z.number().nonnegative().nullable().default(null),
  images: z.array(image).default([]),
  inventory: z
    .object({
      available: z.number(),
      onHand: z.number(),
      reserved: z.number(),
      pending: z.number(),
    })
    .optional(),
  suppliers: z
    .array(z.object({ name: z.string(), reference: z.string(), preferred: z.boolean().optional() }))
    .default([]),
  price_history: z.array(z.unknown()).default([]),
});
const family = z.object({
  productId: z.string(),
  title: z.string(),
  sourceUrl: z.string().url(),
  checkedAt: z.string(),
  variants: z.array(
    z.object({
      sourceVariantId: z.string(),
      title: z.string(),
      sku: z.string(),
      imageId: z.union([z.string(), z.number()]),
      imageUrl: z.string().default(''),
      rights: z.string().optional(),
      exactMatchToLihen: z.boolean().optional(),
    }),
  ),
});
export const localLabSchema = z.object({
  mode: z.literal('LOCAL_REHEARSAL'),
  readAt: z.string().datetime(),
  products: z.array(product),
  family: family.optional(),
});
export type LabData = z.infer<typeof localLabSchema>;
const empty: LabData = { mode: 'LOCAL_REHEARSAL', readAt: '', products: [] };
let current = empty;
const listeners = new Set<() => void>();
export function useLocalLabData() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => current,
    () => empty,
  );
}
export function loadLocalLabData(text: string) {
  if (text.length > 2_000_000) throw new Error('Archivo local demasiado grande');
  const parsed = localLabSchema.parse(JSON.parse(text));
  if (new Set(parsed.products.map((p) => p.id)).size !== parsed.products.length)
    throw new Error('Identificadores duplicados');
  // Family pictures are evidence only: no remote previews without a separate rights decision.
  if (parsed.family)
    parsed.family.variants = parsed.family.variants.map((v) => ({ ...v, imageUrl: '' }));
  current = parsed;
  listeners.forEach((listener) => listener());
}
export function clearLocalLabData() {
  current = empty;
  listeners.forEach((listener) => listener());
}
