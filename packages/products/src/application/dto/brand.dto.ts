import type { BrandStatus } from '../../domain/brand';
export interface BrandDTO { readonly id:string; readonly name:string; readonly normalizedName:string; readonly status:BrandStatus; }
