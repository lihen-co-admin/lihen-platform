import { describe, expect, it } from 'vitest';
import {
  LocalFormDraft,
  draftStorageKey,
  type DraftScope,
  type DraftStorage,
} from '../src/drafts/local-form-draft';
import { productEditDraftCodec, emptyProductEditDraft } from '../src/drafts/product-edit-draft';
import { devFormDraftsEnabled } from '../src/drafts/FormDraftProvider';

const scope: DraftScope = {
  userId: 'user-a',
  module: 'products',
  entity: 'product-a',
  form: 'identity',
};
const original = { ...emptyProductEditDraft, name: 'Original' };
const edited = { ...original, name: 'Editado' };
function storage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe('shared DEV form draft lifecycle', () => {
  it('persists synchronously before navigation and restores only on explicit request', () => {
    const disk = storage();
    const first = new LocalFormDraft(disk, scope, productEditDraftCodec, original);
    first.edit(edited);
    expect(disk.values.size).toBe(1);
    first.suspend();
    expect(first.getSnapshot().pending).toBe(true);
    const reopened = new LocalFormDraft(disk, scope, productEditDraftCodec, original);
    expect(reopened.getSnapshot().value).toEqual(original);
    expect(reopened.getSnapshot().pending).toBe(true);
    reopened.restore();
    expect(reopened.getSnapshot().value).toEqual(edited);
    expect(reopened.getSnapshot().dirty).toBe(true);
  });

  it.each(['userId', 'module', 'entity', 'form'] as const)('isolates drafts by %s', (part) => {
    const disk = storage();
    new LocalFormDraft(disk, scope, productEditDraftCodec, original).edit(edited);
    const other = new LocalFormDraft(
      disk,
      { ...scope, [part]: 'other' },
      productEditDraftCodec,
      original,
    );
    expect(other.getSnapshot().pending).toBe(false);
    expect(other.getSnapshot().value).toEqual(original);
  });

  it('keeps the operation identity on reload and never confirms local state without readback', () => {
    const disk = storage();
    const first = new LocalFormDraft(disk, scope, productEditDraftCodec, original);
    first.edit(edited);
    const op = first.beginSave();
    const reopened = new LocalFormDraft(disk, scope, productEditDraftCodec, original);
    expect(reopened.getSnapshot().operation).toEqual({ ...op, phase: 'UNCERTAIN' });
    reopened.restore();
    expect(() => reopened.edit(original)).toThrow();
    expect(reopened.beginSave()).toEqual(op);
    reopened.markUncertain();
    expect(reopened.confirmReadback(original)).toBe(false);
    expect(disk.values.size).toBe(1);
    expect(reopened.confirmReadback(edited)).toBe(true);
    expect(reopened.getSnapshot().dirty).toBe(false);
    expect(disk.values.size).toBe(0);
  });

  it('preserves the draft on a definitive rejection and allows corrected content', () => {
    const disk = storage();
    const draft = new LocalFormDraft(disk, scope, productEditDraftCodec, original);
    draft.edit(edited);
    const op = draft.beginSave();
    draft.rejectBeforeWrite();
    draft.edit(original);
    expect(disk.values.size).toBe(1);
    expect(draft.beginSave().key).not.toBe(op.key);
  });

  it('detects changed server evidence and requires review before dispatch', () => {
    const disk = storage();
    new LocalFormDraft(disk, scope, productEditDraftCodec, original).edit(edited);
    const draft = new LocalFormDraft(disk, scope, productEditDraftCodec, {
      ...original,
      name: 'Otro editor',
    });
    draft.restore();
    expect(draft.getSnapshot().conflict).toBe(true);
    expect(() => draft.beginSave()).toThrow();
    draft.acknowledgeConflict();
    expect(draft.beginSave().key).toBeTruthy();
    draft.updateServer(original);
    expect(draft.getSnapshot().value).toEqual(edited);
  });

  it('logout disables stale completion callbacks while preserving the same-user draft on disk', () => {
    const disk = storage();
    const draft = new LocalFormDraft(disk, scope, productEditDraftCodec, original);
    draft.edit(edited);
    draft.beginSave();
    draft.deactivate();
    expect(draft.confirmReadback(edited)).toBe(false);
    expect(() => draft.beginSave()).toThrow();
    expect(
      new LocalFormDraft(disk, scope, productEditDraftCodec, original).getSnapshot().pending,
    ).toBe(true);
  });

  it('refuses to dispatch if storage fails and retains in-memory values', () => {
    const broken: DraftStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {},
    };
    const draft = new LocalFormDraft(broken, scope, productEditDraftCodec, original);
    draft.edit(edited);
    expect(draft.getSnapshot().storageError).toBe(true);
    expect(draft.getSnapshot().value).toEqual(edited);
    expect(() => draft.beginSave()).toThrow('no se envió');
  });

  it('does not delete evidence when cleanup fails', () => {
    const disk = storage();
    const draft = new LocalFormDraft(
      {
        ...disk,
        removeItem: () => {
          throw new Error('denied');
        },
      },
      scope,
      productEditDraftCodec,
      original,
    );
    draft.edit(edited);
    draft.beginSave();
    expect(draft.confirmReadback(edited)).toBe(false);
    expect(disk.values.size).toBe(1);
  });

  it.each(['password', 'access_token', 'customerPhone', 'file'])(
    'rejects unreviewed field %s before storage',
    (key) => {
      const disk = storage();
      const draft = new LocalFormDraft(disk, scope, productEditDraftCodec, original);
      expect(() => draft.edit({ ...edited, [key]: 'private' })).toThrow();
      expect(disk.values.size).toBe(0);
    },
  );

  it('rejects corrupted or foreign records without silently removing them', () => {
    const disk = storage();
    disk.values.set(draftStorageKey(scope), '{broken');
    const draft = new LocalFormDraft(disk, scope, productEditDraftCodec, original);
    expect(draft.getSnapshot().storageError).toBe(true);
    expect(disk.values.get(draftStorageKey(scope))).toBe('{broken');
    expect(() => draft.edit(edited)).toThrow('Unreadable draft');
  });

  it('requires the explicit opt-in and the exact DEV project; PROD is disabled', () => {
    const env = {
      VITE_LOCAL_FORM_DRAFTS_MODE: 'controlled',
      VITE_AUTH_MODE: 'supabase',
      VITE_SUPABASE_URL: 'https://vnmkupzptujtywnnabkp.supabase.co',
    };
    expect(devFormDraftsEnabled(env)).toBe(true);
    expect(devFormDraftsEnabled({ ...env, VITE_LOCAL_FORM_DRAFTS_MODE: 'blocked' })).toBe(false);
    expect(devFormDraftsEnabled({ ...env, VITE_SUPABASE_URL: 'https://prod.supabase.co' })).toBe(
      false,
    );
  });
  it('blocks concurrent writes and refuses to overwrite or clear another tab draft', () => {
    const disk = storage();
    const draft = new LocalFormDraft(disk, scope, productEditDraftCodec, original);
    draft.edit(edited);
    draft.beginSave();
    expect(() => draft.beginSave()).toThrow('already in flight');
    const other = new LocalFormDraft(disk, scope, productEditDraftCodec, original);
    other.restore();
    other.rejectBeforeWrite();
    other.edit({ ...edited, name: 'Other tab' });
    const latest = disk.values.get(draftStorageKey(scope));
    draft.markUncertain();
    expect(disk.values.get(draftStorageKey(scope))).toBe(latest);
    expect(draft.confirmReadback(edited)).toBe(false);
    expect(disk.values.get(draftStorageKey(scope))).toBe(latest);
  });
});
