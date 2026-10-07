import { describe, expect, it } from 'vitest';
import { configurationReadiness, controlledCapabilities } from '../src/domain/configuration-readiness';

describe('configuration readiness', () => {
  it('reports memory and blocked defaults without implying durability', () => {
    const result = configurationReadiness({});
    expect(result.source).toBe('memory');
    expect(result.editorialSync).toBe('disabled');
    expect(result.capabilities.every(row => row.status === 'BLOCKED')).toBe(true);
  });
  it('requires durable authentication and credentials for every controlled capability', () => {
    const modes = Object.fromEntries(Object.values(controlledCapabilities).map(key => [key, 'controlled']));
    expect(configurationReadiness(modes).capabilities.every(row => row.status === 'REVIEW')).toBe(true);
    const result = configurationReadiness({ ...modes, VITE_AUTH_MODE: 'supabase', VITE_PRODUCT_READ_SOURCE: 'supabase', VITE_SUPABASE_URL: 'SECRET_URL', VITE_SUPABASE_PUBLISHABLE_KEY: 'SECRET_KEY' });
    expect(result.capabilities.every(row => row.status === 'READY')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });
  it('never echoes unexpected mode values', () => {
    expect(JSON.stringify(configurationReadiness({VITE_AUTH_MODE: 'SECRET', VITE_PUBLIC_HUB_MODE: 'SECRET'}))).not.toContain('SECRET');
  });
});
