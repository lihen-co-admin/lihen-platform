import type { IdGenerator } from '@lihen/core';
import { Money } from '@lihen/shared';
import { Product } from '../../domain/product';
import { BrandNotFoundError,CategoryNotFoundError,DuplicateCatalogCodeError,DuplicateProductSkuError } from '../../domain/errors/product-errors';
import type { ProductRepository } from '../../ports/product-repository';
import type { BrandRepository } from '../../ports/brand-repository';
import type { CategoryRepository } from '../../ports/category-repository';
import type { ProductDetailDTO } from '../dto/product-detail.dto';
import { resolveProductTaxonomy } from '../product-taxonomy-resolver';
import type { CreateProductCommand } from './create-product.command';
export class CreateProductHandler{
 public constructor(private readonly products:ProductRepository,private readonly ids:IdGenerator,private readonly brands?:BrandRepository,private readonly categories?:CategoryRepository){}
 public async execute(command:CreateProductCommand):Promise<ProductDetailDTO>{
  const {sku,catalogCode,slug,name,businessLine,brandId,categoryId,status,salePrice}=command.payload;
  if(sku&&await this.products.findBySku(sku))throw new DuplicateProductSkuError(sku);
  if(catalogCode&&await this.products.findByCatalogCode(catalogCode))throw new DuplicateCatalogCodeError(catalogCode);
  if(brandId&&this.brands&&!(await this.brands.findById(brandId)))throw new BrandNotFoundError(brandId);
  if(categoryId&&this.categories){const c=await this.categories.findById(categoryId);if(!c)throw new CategoryNotFoundError(categoryId);if(c.businessLine!==businessLine)throw new Error('LIHEN_CATEGORY_BUSINESS_LINE_MISMATCH');}
  const product=new Product({id:this.ids.generate(),...(sku?{sku}:{}),...(catalogCode?{catalogCode}:{}),...(slug?{slug}:{}),name,businessLine,...(brandId?{brandId}:{}),...(categoryId?{categoryId}:{}),status,salePrice:new Money(salePrice,'COP')});
  const created=await this.products.create(product,{actorId:command.actorId,operationKey:command.operationKey??command.commandId});
  const t=await resolveProductTaxonomy(created,this.brands,this.categories);
  return{id:created.id,...(created.sku?{sku:created.sku}:{}),...(created.catalogCode?{catalogCode:created.catalogCode}:{}),slug:created.slug,name:created.name,businessLine:created.businessLine,...(created.brandId?{brandId:created.brandId}:{}),...(t.brandName?{brandName:t.brandName}:{}),...(created.categoryId?{categoryId:created.categoryId}:{}),...(t.categoryName?{categoryName:t.categoryName}:{}),status:created.status,salePrice:{amount:created.salePrice.amount,currency:created.salePrice.currency}};
 }
}
