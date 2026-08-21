import type { BusinessLine } from './business-line';
export type CategoryStatus = 'ACTIVE' | 'INACTIVE';
export interface CategoryProps { readonly id:string; readonly name:string; readonly normalizedName:string; readonly businessLine:BusinessLine; readonly parentId?:string; readonly status:CategoryStatus; }
export class Category {
 public readonly id:string; public readonly name:string; public readonly normalizedName:string; public readonly businessLine:BusinessLine; public readonly parentId:string|undefined; public readonly status:CategoryStatus;
 public constructor(props:CategoryProps){ const name=props.name.trim(); const normalizedName=props.normalizedName.trim(); if(!name) throw new Error('Category name is required.'); if(!normalizedName) throw new Error('Category normalizedName is required.'); this.id=props.id; this.name=name; this.normalizedName=normalizedName; this.businessLine=props.businessLine; this.parentId=props.parentId; this.status=props.status; }
}
