import { Product } from '../../domain/product';
import { BrandNotFoundError,CategoryNotFoundError,DuplicateCatalogCodeError,DuplicateProductSkuError,ProductNotFoundError } from '../../domain/errors/product-errors';
import type { ProductRepository } from '../../ports/product-repository';
import type { BrandRepository } from '../../ports/brand-repository';
import type { CategoryRepository } from '../../ports/category-repository';
import type { ProductDetailDTO } from '../dto/product-detail.dto';
import { resolveProductTaxonomy } from '../product-taxonomy-resolver';
import type { UpdateProductCommand } from './update-product.command';
export class UpdateProductHandler{
 public constructor(private readonly products:ProductRepository,private readonly brands?:BrandRepository,private readonly categories?:CategoryRepository){}
 public async execute(command:UpdateProductCommand):Promise<ProductDetailDTO>{
  const {productId,sku,catalogCode,slug,name,businessLine,brandId,categoryId,status}=command.payload;
  const current=await this.products.findById(productId);if(!current)throw new ProductNotFoundError(productId);
  if(sku){const d=await this.products.findBySku(sku);if(d&&d.id!==productId)throw new DuplicateProductSkuError(sku);}
  if(catalogCode){const d=await this.products.findByCatalogCode(catalogCode);if(d&&d.id!==productId)throw new DuplicateCatalogCodeError(catalogCode);}
  if(brandId&&this.brands&&!(await this.brands.findById(brandId)))throw new BrandNotFoundError(brandId);
  if(categoryId&&this.categories){const c=await this.categories.findById(categoryId);if(!c)throw new CategoryNotFoundError(categoryId);if(c.businessLine!==businessLine)throw new Error('LIHEN_CATEGORY_BUSINESS_LINE_MISMATCH');}
  const updated=new Product({id:current.id,...(sku?{sku}:{}),...(catalogCode?{catalogCode}:{}),slug:slug??current.slug,name,businessLine,...(brandId?{brandId}:{}),...(categoryId?{categoryId}:{}),status,salePrice:current.salePrice});
  const saved=await this.products.update(updated,{actorId:command.actorId,operationKey:command.operationKey??command.commandId});
  const t=await resolveProductTaxonomy(saved,this.brands,this.categories);
  return{id:saved.id,...(saved.sku?{sku:saved.sku}:{}),...(saved.catalogCode?{catalogCode:saved.catalogCode}:{}),slug:saved.slug,name:saved.name,businessLine:saved.businessLine,...(saved.brandId?{brandId:saved.brandId}:{}),...(t.brandName?{brandName:t.brandName}:{}),...(saved.categoryId?{categoryId:saved.categoryId}:{}),...(t.categoryName?{categoryName:t.categoryName}:{}),status:saved.status,salePrice:{amount:saved.salePrice.amount,currency:saved.salePrice.currency}};
 }
}
