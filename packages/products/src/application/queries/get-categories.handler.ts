import type { CategoryDTO } from '../dto/category.dto';
import type { CategoryRepository } from '../../ports/category-repository';
import type { GetCategoriesQuery } from './get-categories.query';
export class GetCategoriesHandler{public constructor(private readonly categories:CategoryRepository){}public async execute(_query:GetCategoriesQuery):Promise<readonly CategoryDTO[]>{return(await this.categories.findAll()).map(x=>({id:x.id,name:x.name,normalizedName:x.normalizedName,businessLine:x.businessLine,...(x.parentId?{parentId:x.parentId}:{}),status:x.status}));}}
