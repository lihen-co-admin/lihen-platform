import { existsSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
const read = (path: string) => readFileSync(path, 'utf8');
const provider = read('supabase/functions/marketing-social-runtime/tiktok-provider.ts');
const runtime = read('supabase/functions/marketing-social-runtime/index.ts');
const http = read('supabase/functions/marketing-social-runtime/tiktok-http.ts');
const migration = read('database/migrations/20260928160000_marketing_tiktok_attempt_evidence.sql');
describe('TikTok governed boundary', () => {
  it('isolates TikTok configuration and fixes official wire mappings', () => {
    expect(provider).not.toMatch(/META_|graph\.facebook|graph\.instagram|fetch\(/);
    expect(provider).toContain("env('TIKTOK_PUBLICATION_ENABLED') === 'true'");
    expect(provider).toContain('return null;');
    expect(provider).not.toContain('TIKTOK_WIRE_CONTRACT');
    expect(http).toContain('physicalVerificationAvailable: false');
    expect(runtime).toContain('get_marketing_editorial_video_assets');
    expect(runtime).not.toMatch(
      /get_marketing_tiktok_video_metadata|duration_seconds|duration_verified_etag/,
    );
    expect(
      existsSync('database/migrations/20260928161000_marketing_tiktok_video_duration.sql'),
    ).toBe(false);
    expect(http).toContain('https://open.tiktokapis.com/v2/post/publish/');
    expect(http).toContain("state === 'PUBLISH_COMPLETE'");
    expect(http).not.toContain('FILE_UPLOAD');
    expect(runtime).toContain("from './tiktok-provider.ts'");
    expect(runtime).toContain('executeTikTok(');
  });
  it('never accepts client URLs and keeps uncertainty out of COMPLETE RPC', () => {
    expect(runtime).not.toMatch(/payload\.(videoUrl|publicUrl|mediaUrl)/);
    expect(runtime.indexOf('await executeTikTok(')).toBeGreaterThan(
      runtime.indexOf("'start_marketing_publication_attempt_server_controlled'"),
    );
    expect(runtime).toContain("result.outcome === 'UNCERTAIN'");
    expect(provider.indexOf("kind: 'ACCEPTED'")).toBeLessThan(
      provider.indexOf('transport.status('),
    );
    expect(provider).toContain("status?.state === 'COMPLETE'");
  });
  it('adds evidence without expanding public permissions or enabling execution', () => {
    expect(migration).toContain('add column provider_evidence');
    expect(migration).toContain('for update');
    expect(migration).toContain("v_attempt.status <> 'IN_PROGRESS'");
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('to service_role');
    expect(migration).toContain('LIHEN_TIKTOK_PUBLISH_ID_CONFLICT');
    expect(migration).not.toMatch(
      /access_token|refresh_token|http_post|cron\.schedule|update\s+storage\.buckets/i,
    );
  });
});
