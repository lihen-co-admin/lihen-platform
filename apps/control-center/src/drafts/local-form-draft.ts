export interface DraftScope {
  readonly userId: string;
  readonly module: string;
  readonly entity: string;
  readonly form: string;
}

export interface DraftCodec<T> {
  /** Must reject unknown fields and return only reviewed, non-sensitive fields. */
  parse(value: unknown): T;
}

export interface DraftOperation {
  readonly key: string;
  readonly requestedAt: string;
  readonly phase: 'IN_FLIGHT' | 'UNCERTAIN';
}

interface DraftRecord<T> {
  readonly version: 1;
  readonly scope: DraftScope;
  readonly base: T;
  readonly value: T;
  readonly operation: DraftOperation | null;
}

export interface DraftSnapshot<T> {
  readonly value: T;
  readonly pending: boolean;
  readonly restored: boolean;
  readonly dirty: boolean;
  readonly conflict: boolean;
  readonly operation: DraftOperation | null;
  readonly storageError: boolean;
}

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const prefix = 'lihen:dev:form-draft:v1:';

export function draftStorageKey(scope: DraftScope): string {
  if (Object.values(scope).some((part) => !part)) throw new Error('Incomplete draft scope.');
  return (
    prefix +
    [scope.userId, scope.module, scope.entity, scope.form].map(encodeURIComponent).join(':')
  );
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** No network operations: adapters explicitly send and verify their own controlled writes. */
export class LocalFormDraft<T> {
  private readonly key: string;
  private record: DraftRecord<T> | null = null;
  private snapshot: DraftSnapshot<T>;
  private readonly listeners = new Set<() => void>();
  private active = true;
  private lastStored: string | null = null;
  private readable = true;

  constructor(
    private readonly storage: DraftStorage,
    private readonly scope: DraftScope,
    private readonly codec: DraftCodec<T>,
    private server: T,
  ) {
    this.key = draftStorageKey(scope);
    this.server = codec.parse(server);
    this.snapshot = {
      value: this.server,
      pending: false,
      restored: false,
      dirty: false,
      conflict: false,
      operation: null,
      storageError: false,
    };
    try {
      const raw = storage.getItem(this.key);
      this.lastStored = raw;
      if (raw) {
        if (raw.length > 32_768) throw new Error('Draft too large.');
        const parsed = JSON.parse(raw) as DraftRecord<unknown>;
        if (parsed.version !== 1 || !same(parsed.scope, scope))
          throw new Error('Draft scope/version mismatch.');
        const operation = parsed.operation;
        if (
          operation &&
          (!/^[0-9a-f-]{36}$/i.test(operation.key) ||
            !Number.isFinite(Date.parse(operation.requestedAt)) ||
            !['IN_FLIGHT', 'UNCERTAIN'].includes(operation.phase))
        )
          throw new Error('Invalid operation.');
        this.record = {
          version: 1,
          scope,
          base: codec.parse(parsed.base),
          value: codec.parse(parsed.value),
          operation: operation
            ? { key: operation.key, requestedAt: operation.requestedAt, phase: 'UNCERTAIN' }
            : null,
        };
        this.snapshot = {
          ...this.snapshot,
          pending: true,
          dirty: true,
          conflict: !same(this.record.base, this.server),
          operation: this.record.operation,
        };
      }
    } catch {
      this.readable = false;
      // Preserve unreadable storage; never replace it silently with a fresh draft.
      this.snapshot = { ...this.snapshot, storageError: true };
    }
  }

  getSnapshot = (): DraftSnapshot<T> => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(next: DraftSnapshot<T>): void {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }

  private persist(): boolean {
    if (!this.active || !this.record) return false;
    try {
      const json = JSON.stringify(this.record);
      if (json.length > 32_768) throw new Error('Draft too large.');
      if (!this.readable || this.storage.getItem(this.key) !== this.lastStored)
        throw new Error('Another tab changed this draft.');
      this.storage.setItem(this.key, json);
      this.lastStored = json;
      return true;
    } catch {
      this.publish({ ...this.snapshot, storageError: true });
      return false;
    }
  }

  /** Refresh server evidence without overwriting the local edit. */
  updateServer(value: T): void {
    if (!this.active) return;
    this.server = this.codec.parse(value);
    this.publish({
      ...this.snapshot,
      value: this.snapshot.dirty && this.snapshot.restored ? this.snapshot.value : this.server,
      conflict: Boolean(this.record && !same(this.record.base, this.server)),
    });
  }

  suspend(): void {
    if (!this.active || !this.record) return;
    this.publish({ ...this.snapshot, value: this.server, pending: true, restored: false });
  }

  restore(): void {
    if (!this.active || !this.record) return;
    this.publish({ ...this.snapshot, value: this.record.value, pending: false, restored: true });
  }

  /** Explicit review of fresh server values is required before overwriting changed server data. */
  acknowledgeConflict(): void {
    if (!this.active || !this.record || this.record.operation) return;
    this.record = { ...this.record, base: this.server };
    this.publish({ ...this.snapshot, conflict: false });
    this.persist();
  }

  edit(value: T): void {
    if (!this.readable) throw new Error('Unreadable draft; existing storage preserved.');
    if (!this.active || this.snapshot.pending || this.snapshot.operation)
      throw new Error('Restore or reconcile the pending draft first.');
    const safeValue = this.codec.parse(value);
    this.record = {
      version: 1,
      scope: this.scope,
      base: this.record?.base ?? this.server,
      value: safeValue,
      operation: null,
    };
    this.publish({ ...this.snapshot, value: safeValue, restored: true, dirty: true });
    this.persist();
  }

  beginSave(): DraftOperation {
    if (this.record?.operation?.phase === 'IN_FLIGHT')
      throw new Error('Operation is already in flight.');
    if (!this.active || this.snapshot.pending || this.snapshot.conflict || !this.record)
      throw new Error('Draft is not ready to save.');
    const operation: DraftOperation = this.record.operation
      ? { ...this.record.operation, phase: 'IN_FLIGHT' }
      : { key: crypto.randomUUID(), requestedAt: new Date().toISOString(), phase: 'IN_FLIGHT' };
    this.record = { ...this.record, operation };
    this.publish({ ...this.snapshot, operation });
    // Never send a write unless its identity was stored before dispatch.
    if (!this.persist()) {
      this.markUncertain();
      throw new Error(
        'No se pudo conservar la identidad de la operación; no se envió el guardado.',
      );
    }
    return operation;
  }

  markUncertain(): void {
    if (!this.active || !this.record?.operation) return;
    const operation: DraftOperation = { ...this.record.operation, phase: 'UNCERTAIN' };
    this.record = { ...this.record, operation };
    this.publish({ ...this.snapshot, operation });
    this.persist();
  }

  /** Only adapters with a definitive pre-write rejection may unlock editing. */
  rejectBeforeWrite(): void {
    if (!this.active || !this.record) return;
    this.record = { ...this.record, operation: null };
    this.publish({ ...this.snapshot, operation: null });
    this.persist();
  }

  /** Caller supplies fresh readback; matching local fields alone never confirm persistence. */
  confirmReadback(serverValue: T): boolean {
    if (
      !this.active ||
      !this.record?.operation ||
      !same(this.record.value, this.codec.parse(serverValue))
    )
      return false;
    this.server = this.codec.parse(serverValue);
    try {
      if (this.storage.getItem(this.key) !== this.lastStored)
        throw new Error('Another tab changed this draft.');
      this.storage.removeItem(this.key);
      this.lastStored = null;
    } catch {
      this.publish({ ...this.snapshot, storageError: true });
      return false;
    }
    this.record = null;
    this.publish({
      value: this.server,
      pending: false,
      restored: false,
      dirty: false,
      conflict: false,
      operation: null,
      storageError: false,
    });
    return true;
  }

  /** Logout invalidates callbacks and memory; scoped disk drafts remain for the same user. */
  deactivate(): void {
    this.active = false;
    this.record = null;
    this.listeners.clear();
    this.snapshot = {
      value: this.server,
      pending: false,
      restored: false,
      dirty: false,
      conflict: false,
      operation: null,
      storageError: false,
    };
  }
}
