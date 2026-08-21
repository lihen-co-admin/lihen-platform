import type { CategoryStatus } from '../../domain/category';
import type { BusinessLine } from '../../domain/business-line';
export interface CategoryDTO{readonly id:string;readonly name:string;readonly normalizedName:string;readonly businessLine:BusinessLine;readonly parentId?:string;readonly status:CategoryStatus;}
