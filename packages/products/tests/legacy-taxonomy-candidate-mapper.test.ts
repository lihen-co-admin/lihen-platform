import { describe, expect, it } from 'vitest';
import { LegacyTaxonomyCandidateMapper, normalizeLegacyTaxonomyText } from '../src';
describe('LegacyTaxonomyCandidateMapper',()=>{
 it('keeps visible legacy text but derives normalized matching candidates',()=>{const result=LegacyTaxonomyCandidateMapper.toCandidate({business_line:' Beauty Care ',brand:'  Púrpure  ',category:'Cuidado Personal',subcategory:'Labios'});expect(result).toEqual({businessLine:'BEAUTY_CARE',brandName:'Púrpure',brandNormalizedName:'purpure',categoryPath:['Cuidado Personal','Labios']});});
 it('does not invent missing category levels',()=>{expect(LegacyTaxonomyCandidateMapper.toCandidate({brand:'SAMY'}).categoryPath).toEqual([]);});
 it('normalizes accents/case only for matching',()=>{expect(normalizeLegacyTaxonomyText('  ORIGEN BOTÁNICO ')).toBe('origen botanico');});
});
