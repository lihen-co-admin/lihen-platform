import type { Command } from '@lihen/core';
import { z } from 'zod';
import type { ProductStatus } from '../../domain/product-status';
import type { BusinessLine } from '../../domain/business-line';
const optionalTrimmedText=z.string().trim().min(1).optional();
export const updateProductPayloadSchema=z.object({productId:z.string().trim().min(1),sku:optionalTrimmedText,catalogCode:optionalTrimmedText,slug:optionalTrimmedText,name:z.string().trim().min(1,'Product name is required.'),businessLine:z.enum(['BEAUTY_CARE','STYLE']),brandId:optionalTrimmedText,categoryId:optionalTrimmedText,status:z.enum(['ACTIVE','INACTIVE','DISCONTINUED','ARCHIVED'])});
export type UpdateProductPayload={readonly productId:string;readonly sku?:string;readonly catalogCode?:string;readonly slug?:string;readonly name:string;readonly businessLine:BusinessLine;readonly brandId?:string;readonly categoryId?:string;readonly status:ProductStatus};
export type UpdateProductCommand=Command<UpdateProductPayload>&{readonly type:'UPDATE_PRODUCT'};
export interface UpdateProductCommandInput{readonly commandId:string;readonly actorId:string;readonly requestedAt:Date;readonly operationKey?:string;readonly productId:string;readonly sku?:string;readonly catalogCode?:string;readonly slug?:string;readonly name:string;readonly businessLine:BusinessLine;readonly brandId?:string;readonly categoryId?:string;readonly status:ProductStatus;}
export function createUpdateProductCommand(input:UpdateProductCommandInput):UpdateProductCommand{
  const parsed=updateProductPayloadSchema.parse({productId:input.productId,...(input.sku?.trim()?{sku:input.sku}:{}),...(input.catalogCode?.trim()?{catalogCode:input.catalogCode}:{}),...(input.slug?.trim()?{slug:input.slug}:{}),name:input.name,businessLine:input.businessLine,...(input.brandId?.trim()?{brandId:input.brandId}:{}),...(input.categoryId?.trim()?{categoryId:input.categoryId}:{}),status:input.status});
  const payload:UpdateProductPayload={
    productId:parsed.productId,
    ...(parsed.sku!==undefined?{sku:parsed.sku}:{}),
    ...(parsed.catalogCode!==undefined?{catalogCode:parsed.catalogCode}:{}),
    ...(parsed.slug!==undefined?{slug:parsed.slug}:{}),
    name:parsed.name,
    businessLine:parsed.businessLine,
    ...(parsed.brandId!==undefined?{brandId:parsed.brandId}:{}),
    ...(parsed.categoryId!==undefined?{categoryId:parsed.categoryId}:{}),
    status:parsed.status,
  };
  return{type:'UPDATE_PRODUCT',commandId:input.commandId,actorId:input.actorId,requestedAt:input.requestedAt,...(input.operationKey?{operationKey:input.operationKey}:{}),payload};
}
