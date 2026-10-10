import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { editorialDevSyncEnabled } from '../src/domain/editorial-persistence-mode';
import { saveEditorialItemInDev } from '../src/composition/editorial-workspace';
import type { EditorialItem } from '../src/domain/editorial-planning';
afterEach(() => vi.unstubAllEnvs());
describe('editorial durable authority', () => {
  it.each([{}, {DEV:true}, {DEV:false,VITE_EDITORIAL_DEV_SYNC_ENABLED:'true'}, {DEV:true,VITE_EDITORIAL_DEV_SYNC_ENABLED:'false'}])('fails closed without DEV opt-in', async env => {
    expect(editorialDevSyncEnabled(env)).toBe(false);
    vi.stubEnv('DEV', env.DEV === true);
    vi.stubEnv('VITE_EDITORIAL_DEV_SYNC_ENABLED', env.VITE_EDITORIAL_DEV_SYNC_ENABLED ?? '');
    // Match the fixture's missing project configuration instead of inheriting CI values.
    vi.stubEnv('VITE_PRODUCT_READ_SOURCE', '');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    const invoke = vi.fn();
    await expect(saveEditorialItemInDev({} as EditorialItem,{functions:{invoke}})).rejects.toThrow('Persistencia editorial bloqueada');
    expect(invoke).not.toHaveBeenCalled();
  });
  it('keeps canonical data out of localStorage and in-memory repositories', () => {
    const page = readFileSync(new URL('../src/pages/SocialContentPage.tsx',import.meta.url),'utf8');
    expect(page).not.toContain('InMemoryMarketingSocialRepository');
    expect(page.match(/localStorage\.setItem\([^\r\n]+/g)).toEqual(['localStorage.setItem(`${cacheKey}:goals`, JSON.stringify(next));']);
    expect(page).toContain('confirmed.push(await saveEditorialItemInDev(item))');
    expect(page).toContain('editorialDevSyncEnabled(import.meta.env) &&');
    expect(page).not.toContain('EXECUTE_SCHEDULED_PUBLICATION_ATTEMPT');
  });
});
