import { z } from 'zod';
import { parseBusinessLine } from '../domain/business-line';
const nullableText=z.string().trim().nullable().optional();
export const legacyTaxonomyRowSchema=z.object({business_line:nullableText,brand:nullableText,category:nullableText,subcategory:nullableText});
export interface LegacyTaxonomyCandidate{readonly businessLine?:'BEAUTY_CARE'|'STYLE';readonly brandName?:string;readonly brandNormalizedName?:string;readonly categoryPath:readonly string[];}
const clean=(value:string|null|undefined)=>value?.trim()||undefined;
export const normalizeTaxonomyText=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export class LegacyTaxonomyCandidateMapper{public static toCandidate(input:unknown):LegacyTaxonomyCandidate{const row=legacyTaxonomyRowSchema.parse(input);const rawBusinessLine=clean(row.business_line);const brandName=clean(row.brand);const category=clean(row.category);const subcategory=clean(row.subcategory);const categoryPath=[category,subcategory].filter((value):value is string=>Boolean(value));return {...(rawBusinessLine?{businessLine:parseBusinessLine(rawBusinessLine)}:{}),...(brandName?{brandName,brandNormalizedName:normalizeTaxonomyText(brandName)}:{}),categoryPath};}}
