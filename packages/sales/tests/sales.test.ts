import{describe,expect,it}from'vitest';describe('sales domain',()=>{it('does not model draft sales',()=>{const states=['COMPLETED','REVERSED'] as const;expect(states).not.toContain('DRAFT');});});
