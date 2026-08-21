import type { Command } from '@lihen/core';
import { z } from 'zod';
import type { ProductStatus } from '../../domain/product-status';
import type { BusinessLine } from '../../domain/business-line';
const optionalTrimmedText=z.string().trim().min(1).optional();
export const createProductPayloadSchema=z.object({sku:optionalTrimmedText,catalogCode:optionalTrimmedText,slug:optionalTrimmedText,name:z.string().trim().min(1,'Product name is required.'),businessLine:z.enum(['BEAUTY_CARE','STYLE']),brandId:optionalTrimmedText,categoryId:optionalTrimmedText,status:z.enum(['ACTIVE','INACTIVE','DISCONTINUED','ARCHIVED']).default('ACTIVE'),salePrice:z.number().finite().nonnegative()});
export type CreateProductPayload={readonly sku?:string;readonly catalogCode?:string;readonly slug?:string;readonly name:string;readonly businessLine:BusinessLine;readonly brandId?:string;readonly categoryId?:string;readonly status:ProductStatus;readonly salePrice:number};
export type CreateProductCommand=Command<CreateProductPayload>&{readonly type:'CREATE_PRODUCT'};
export interface CreateProductCommandInput{readonly commandId:string;readonly actorId:string;readonly requestedAt:Date;readonly operationKey?:string;readonly sku?:string;readonly catalogCode?:string;readonly slug?:string;readonly name:string;readonly businessLine:BusinessLine;readonly brandId?:string;readonly categoryId?:string;readonly status?:ProductStatus;readonly salePrice:number;}
export function createCreateProductCommand(input:CreateProductCommandInput):CreateProductCommand{
  const parsed=createProductPayloadSchema.parse({...(input.sku?{sku:input.sku}:{}),...(input.catalogCode?{catalogCode:input.catalogCode}:{}),...(input.slug?.trim()?{slug:input.slug}:{}),name:input.name,businessLine:input.businessLine,...(input.brandId?{brandId:input.brandId}:{}),...(input.categoryId?{categoryId:input.categoryId}:{}),...(input.status?{status:input.status}:{}),salePrice:input.salePrice});
  const payload:CreateProductPayload={
    ...(parsed.sku!==undefined?{sku:parsed.sku}:{}),
    ...(parsed.catalogCode!==undefined?{catalogCode:parsed.catalogCode}:{}),
    ...(parsed.slug!==undefined?{slug:parsed.slug}:{}),
    name:parsed.name,
    businessLine:parsed.businessLine,
    ...(parsed.brandId!==undefined?{brandId:parsed.brandId}:{}),
    ...(parsed.categoryId!==undefined?{categoryId:parsed.categoryId}:{}),
    status:parsed.status,
    salePrice:parsed.salePrice,
  };
  return{type:'CREATE_PRODUCT',commandId:input.commandId,actorId:input.actorId,requestedAt:input.requestedAt,...(input.operationKey?{operationKey:input.operationKey}:{}),payload};
}
