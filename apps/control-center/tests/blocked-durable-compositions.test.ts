import { describe, expect, it } from 'vitest';
import { createOperationsComposition } from '../src/composition/operations';
import { createSalesComposition } from '../src/composition/sales';
import { createFinanceComposition } from '../src/composition/finance';
describe('blocked durable compositions', () => {
  it('lets Operations and Dashboard render configuration errors instead of crashing on import', async () => {
    const operations = createOperationsComposition({});
    await expect(operations.getDashboard()).rejects.toThrow('Supabase DEV');
  });
  it('does not create in-memory financial or sales authority when unconfigured', async () => {
    const sales = createSalesComposition({});
    const finance = createFinanceComposition({});
    expect(sales.canWrite).toBe(false);
    expect(finance.canWrite).toBe(false);
    await expect(sales.repository.list()).rejects.toThrow('lectura durable bloqueada');
    await expect(finance.repository.listAccounts()).rejects.toThrow('lectura durable bloqueada');
  });
});
