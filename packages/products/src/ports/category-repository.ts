import type { Category } from '../domain/category';
export interface CategoryRepository { findAll():Promise<readonly Category[]>; findById(id:string):Promise<Category|null>; findByNormalizedName(normalizedName:string):Promise<Category|null>; }
