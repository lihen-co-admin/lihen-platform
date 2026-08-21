import type { ProductStatus } from '../../domain/product-status';
import type { BusinessLine } from '../../domain/business-line';
export interface ProductDetailDTO{readonly id:string;readonly sku?:string;readonly catalogCode?:string;readonly slug:string;readonly name:string;readonly businessLine:BusinessLine;readonly brandId?:string;readonly brandName?:string;readonly categoryId?:string;readonly categoryName?:string;readonly status:ProductStatus;readonly salePrice:{readonly amount:number;readonly currency:string};}
