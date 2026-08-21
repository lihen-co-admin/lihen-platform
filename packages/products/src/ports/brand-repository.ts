import type { Brand } from '../domain/brand';
export interface BrandRepository { findAll():Promise<readonly Brand[]>; findById(id:string):Promise<Brand|null>; findByNormalizedName(normalizedName:string):Promise<Brand|null>; }
