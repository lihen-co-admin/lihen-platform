import type { Currency } from '@lihen/shared';
import type { ProductStatus } from '../../domain/product-status';
import type { BusinessLine } from '../../domain/business-line';
export interface ProductListItemDTO{readonly id:string;readonly sku:string|null;readonly catalogCode:string|null;readonly slug:string;readonly name:string;readonly businessLine:BusinessLine;readonly brandId:string|null;readonly brandName:string|null;readonly categoryId:string|null;readonly categoryName:string|null;readonly status:ProductStatus;readonly salePrice:{readonly amount:number;readonly currency:Currency};}
