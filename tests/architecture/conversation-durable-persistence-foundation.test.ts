import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'database/migrations/20260927200000_conversation_durable_persistence_foundation.sql',
);

const sql = readFileSync(migrationPath, 'utf8');

describe('conversation durable persistence foundation', () => {
  it('persists conversations, product relations, and messages', () => {
    expect(sql).toContain('create table public.conversations');
    expect(sql).toContain('create table public.conversation_products');
    expect(sql).toContain('create table public.conversation_messages');
  });

  it('preserves conversation channels', () => {
    for (const channel of ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'WEB', 'OTHER']) {
      expect(sql).toContain(`'${channel}'`);
    }
  });

  it('preserves conversation statuses', () => {
    for (const status of ['OPEN', 'WAITING_CUSTOMER', 'WAITING_LIHEN', 'RESOLVED', 'CLOSED']) {
      expect(sql).toContain(`'${status}'`);
    }
  });

  it('preserves message direction and sender roles', () => {
    for (const value of ['INBOUND', 'OUTBOUND', 'CUSTOMER', 'LIHEN', 'SYSTEM']) {
      expect(sql).toContain(`'${value}'`);
    }
  });

  it('relates conversations to canonical customer and order records', () => {
    expect(sql).toMatch(/customer_id uuid null[\s\S]*references public\.customers\(id\)/);
    expect(sql).toMatch(/order_id uuid null[\s\S]*references public\.orders\(id\)/);
  });

  it('persists productIds as a normalized relation to canonical products', () => {
    expect(sql).toMatch(
      /conversation_id uuid not null[\s\S]*references public\.conversations\(id\)/,
    );
    expect(sql).toMatch(/product_id uuid not null[\s\S]*references public\.products\(id\)/);
    expect(sql).toContain('primary key (conversation_id, product_id)');
  });

  it('relates messages to their conversation', () => {
    expect(sql).toMatch(
      /conversation_id uuid not null[\s\S]*references public\.conversations\(id\)/,
    );
  });

  it('enables RLS on all durable conversation tables', () => {
    expect(sql.match(/enable row level security;/g)).toHaveLength(3);
  });

  it('does not introduce policies or controlled execution RPCs', () => {
    expect(sql).not.toMatch(/\bcreate\s+policy\b/i);
    expect(sql).not.toMatch(/\bcreate\s+(?:or\s+replace\s+)?function\b/i);
    expect(sql).not.toMatch(/\bsecurity\s+definer\b/i);
    expect(sql).not.toMatch(/\boperation_key\b/i);
  });

  it('does not introduce provider credentials, webhooks, or sending execution', () => {
    expect(sql).not.toMatch(/\baccess_token\b/i);
    expect(sql).not.toMatch(/\brefresh_token\b/i);
    expect(sql).not.toMatch(/\bphone_number_id\b/i);
    expect(sql).not.toMatch(/\bwaba_id\b/i);
    expect(sql).not.toMatch(/\bwebhook\b/i);
    expect(sql).not.toMatch(/\bWHATSAPP_SENDING_ENABLED\b/i);
    expect(sql).not.toMatch(/\bEXECUTE_WHATSAPP\b/i);
  });

  it('does not persist later conversation intelligence contracts', () => {
    expect(sql).not.toMatch(/\bconversation_intents?\b/i);
    expect(sql).not.toMatch(/\bsuggested_repl(?:y|ies)\b/i);
    expect(sql).not.toMatch(/\bconversation_follow_ups?\b/i);
  });
});
