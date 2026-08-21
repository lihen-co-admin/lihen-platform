import { Money } from '@lihen/shared';
import { Product } from '../domain/product';
import { parseBusinessLine } from '../domain/business-line';
import type { ProductStatus } from '../domain/product-status';
import { legacyProductRowSchema, type LegacyProductRow } from './legacy-product-row';
const STATUS_MAP:Record<string,ProductStatus>={ACTIVE:'ACTIVE',ACTIVO:'ACTIVE',INACTIVE:'INACTIVE',INACTIVO:'INACTIVE',DISCONTINUED:'DISCONTINUED',DESCONTINUADO:'DISCONTINUED',ARCHIVED:'ARCHIVED',ARCHIVADO:'ARCHIVED'};
function normalizeOptionalText(value:string|null|undefined){const n=value?.trim();return n||undefined;}
function parseSalePrice(value:LegacyProductRow['sale_price']){const amount=typeof value==='number'?value:Number(value);if(!Number.isFinite(amount)||amount<0)throw new Error(`Invalid legacy product sale_price: ${String(value)}`);return amount;}
function mapStatus(value:string):ProductStatus{const status=STATUS_MAP[value.trim().toUpperCase()];if(!status)throw new Error(`Unsupported legacy product status: ${value}`);return status;}
export class LegacyProductMapper{public static toDomain(input:unknown):Product{const row=legacyProductRowSchema.parse(input);const sku=normalizeOptionalText(row.sku);const catalogCode=normalizeOptionalText(row.catalog_code);const brandId=normalizeOptionalText(row.brand_id);const categoryId=normalizeOptionalText(row.category_id);return new Product({id:row.id,...(sku?{sku}:{}),...(catalogCode?{catalogCode}:{}),slug:row.slug,name:row.name,businessLine:parseBusinessLine(row.business_line),...(brandId?{brandId}:{}),...(categoryId?{categoryId}:{}),status:mapStatus(row.status),salePrice:new Money(parseSalePrice(row.sale_price),'COP')});}}
