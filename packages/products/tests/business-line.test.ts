import { describe,expect,it } from 'vitest';
import { parseBusinessLine } from '../src/domain/business-line';
import { assessProductImportCandidate } from '../src/domain/product-import-candidate';
describe('canonical business lines',()=>{
 it('accepts Beauty Care and Style',()=>{expect(parseBusinessLine('Beauty Care')).toBe('BEAUTY_CARE');expect(parseBusinessLine('STYLE')).toBe('STYLE');});
 it('carries line through candidate assessment',()=>{expect(assessProductImportCandidate({referenceId:'S-1',businessLine:'STYLE',name:'Camiseta',categoryId:'cat-style'}).businessLine).toBe('STYLE');});
});
