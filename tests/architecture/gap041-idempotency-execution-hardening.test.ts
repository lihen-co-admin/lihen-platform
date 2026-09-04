import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const firstMigration = () =>
  readFileSync(
    join(root, 'database/migrations/20260904164229_gap041_control_plane_idempotency_atomic_prepare_hardening.sql'),
    'utf8',
  );

const atomicityFix = () =>
  readFileSync(
    join(root, 'database/migrations/20260904164353_gap041_control_plane_idempotency_atomic_prepare_ambiguity_fix.sql'),
    'utf8',
  );

const finalMigration = () =>
  readFileSync(
    join(root, 'database/migrations/20260904164452_gap041_control_plane_expiry_replay_ambiguity_fix.sql'),
    'utf8',
  );

const intelligenceCore = () =>
  readFileSync(
    join(root, 'packages/intelligence-core/src/control-plane.ts'),
    'utf8',
  );

describe('GAP-041 control-plane idempotency hardening', () => {
  it('preserves the additive DEV migration history', () => {
    expect(firstMigration()).toContain('control_center_operation_intents');
    expect(atomicityFix()).toContain(
      'on conflict on constraint control_center_operation_intents_operation_key_key do nothing',
    );
    expect(finalMigration()).toContain(
      'on conflict on constraint control_center_operation_intents_operation_key_key do nothing',
    );
  });

  it('does not create a second command engine or idempotency table', () => {
    const combined = `${firstMigration()}\n${atomicityFix()}\n${finalMigration()}`;

    expect(combined).not.toMatch(/create\s+table/i);
    expect(combined).not.toMatch(/create\s+type/i);
  });

  it('preserves actor-bound operation-key ownership', () => {
    const source = finalMigration();

    expect(source).toContain('v_intent.actor_id <> v_actor');
    expect(source).toContain('LIHEN_OPERATION_KEY_OWNERSHIP_MISMATCH');
  });

  it('rejects same-key reuse with a different operation or request fingerprint', () => {
    const source = finalMigration();

    expect(source).toContain('v_intent.operation_code <> p_operation_code');
    expect(source).toContain('v_intent.request_fingerprint <> v_fingerprint');
    expect(source).toContain('LIHEN_OPERATION_KEY_REUSE_MISMATCH');
  });

  it('preserves and disambiguates PREVIEWED to EXPIRED replay', () => {
    const source = finalMigration();

    expect(source).toContain(
      "v_intent.status='PREVIEWED' and v_intent.expires_at <= now()",
    );
    expect(source).toContain(
      'update lihen_private.control_center_operation_intents as i',
    );
    expect(source).toContain('where i.intent_id=v_intent.intent_id');
    expect(source).toContain('returning i.* into v_intent');
  });

  it('keeps business execution disabled', () => {
    const source = finalMigration();

    expect(source).toContain("'execution_enabled', false");
    expect(source).toContain("'PREVIEW_ONLY_NO_BUSINESS_MUTATION'");
    expect(source).toMatch(/\r?\n\s*false,\r?\n\s*v_intent\.status,/);
  });

  it('keeps SQL/RPC persistence out of Intelligence Core', () => {
    const source = intelligenceCore();

    expect(source).not.toMatch(/@supabase\/|@lihen\/database|react/i);
    expect(source).not.toMatch(
      /\.rpc\s*\(|\.from\s*\(|insert\s+into|update\s+\w+\s+set/i,
    );
  });
});
