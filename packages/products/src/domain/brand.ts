export type BrandStatus = 'ACTIVE' | 'INACTIVE';
export interface BrandProps { readonly id:string; readonly name:string; readonly normalizedName:string; readonly status:BrandStatus; }
export class Brand {
 public readonly id:string; public readonly name:string; public readonly normalizedName:string; public readonly status:BrandStatus;
 public constructor(props:BrandProps){ const name=props.name.trim(); const normalizedName=props.normalizedName.trim(); if(!name) throw new Error('Brand name is required.'); if(!normalizedName) throw new Error('Brand normalizedName is required.'); this.id=props.id; this.name=name; this.normalizedName=normalizedName; this.status=props.status; }
}
