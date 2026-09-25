import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'database/migrations/20260925001000_marketing_social_durable_persistence_foundation.sql',
);

const sql = readFileSync(migrationPath, 'utf8');

describe('marketing social durable persistence foundation', () => {
  it('persists the three existing social domain contracts', () => {
    expect(sql).toContain(
      'create table public.marketing_content_schedules',
    );
    expect(sql).toContain(
      'create table public.marketing_prepared_publications',
    );
    expect(sql).toContain(
      'create table public.marketing_publication_attempts',
    );
  });

  it('preserves content schedule review states', () => {
    for (const status of [
      'DRAFT',
      'READY_FOR_REVIEW',
      'APPROVED',
      'CANCELLED',
    ]) {
      expect(sql).toContain(`'${status}'`);
    }
  });

  it('preserves prepared publication review states', () => {
    for (const status of [
      'PREPARED',
      'IN_REVIEW',
      'APPROVED',
      'CANCELLED',
    ]) {
      expect(sql).toContain(`'${status}'`);
    }
  });

  it('preserves publication attempt states', () => {
    for (const status of [
      'PENDING',
      'IN_PROGRESS',
      'SUCCEEDED',
      'FAILED',
      'CANCELLED',
    ]) {
      expect(sql).toContain(`'${status}'`);
    }
  });

  it('relates prepared publications to schedules without making scheduling execution authoritative', () => {
    expect(sql).toMatch(
      /schedule_id uuid null[\s\S]*references public\.marketing_content_schedules\(id\)/,
    );
  });

  it('relates publication attempts to prepared publications', () => {
    expect(sql).toMatch(
      /prepared_publication_id uuid not null[\s\S]*references public\.marketing_prepared_publications\(id\)/,
    );
    expect(sql).toContain(
      'unique (prepared_publication_id, attempt_number)',
    );
  });

  it('enables RLS on all three durable tables', () => {
    expect(sql.match(/enable row level security;/g)).toHaveLength(3);
  });

  it('does not introduce permissive policies or controlled execution RPCs', () => {
    expect(sql).not.toMatch(/\bcreate\s+policy\b/i);
    expect(sql).not.toMatch(/\bcreate\s+(?:or\s+replace\s+)?function\b/i);
    expect(sql).not.toMatch(/\bsecurity\s+definer\b/i);
    expect(sql).not.toMatch(/\boperation_key\b/i);
  });

  it('does not introduce social accounts, credentials, messaging, or provider execution', () => {
    expect(sql).not.toMatch(/\bsocial_accounts?\b/i);
    expect(sql).not.toMatch(/\baccess_token\b/i);
    expect(sql).not.toMatch(/\brefresh_token\b/i);
    expect(sql).not.toMatch(/\bMessagingPort\b/i);
    expect(sql).not.toMatch(/\bSocialPublishingPort\b/i);
    expect(sql).not.toMatch(/\bmeta\b/i);
    expect(sql).not.toMatch(/\btiktok\b/i);
    expect(sql).not.toMatch(/\bwhatsapp\b/i);
  });
});
