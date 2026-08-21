import { z } from 'zod';
const nullableText = z.string().trim().nullable().optional();
const numericLike = z.union([z.number(), z.string()]);
export const legacyProductRowSchema = z.object({
  id:z.string().min(1), sku:nullableText, catalog_code:nullableText, slug:z.string().min(1), name:z.string().min(1),
  business_line:z.string().trim().min(1), status:z.string().min(1), sale_price:numericLike,
  brand_id:z.string().uuid().nullable().optional(), category_id:z.string().uuid().nullable().optional(),
});
export type LegacyProductRow = z.infer<typeof legacyProductRowSchema>;
