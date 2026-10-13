import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import {
  LocalFormDraft,
  type DraftCodec,
  type DraftScope,
  type DraftStorage,
} from './local-form-draft';

class DraftRegistry {
  private readonly sessions = new Map<string, LocalFormDraft<unknown>>();
  constructor(
    readonly userId: string | null,
    private readonly enabled: boolean,
  ) {}

  open<T>(
    scope: Omit<DraftScope, 'userId'>,
    codec: DraftCodec<T>,
    initial: T,
  ): LocalFormDraft<T> | null {
    if (!this.enabled || !this.userId) return null;
    const key = JSON.stringify(scope);
    let session = this.sessions.get(key);
    if (!session) {
      // Access can throw in private/blocked browser contexts; the session surfaces that failure.
      const storage: DraftStorage = {
        getItem: (name) => window.localStorage.getItem(name),
        setItem: (name, value) => window.localStorage.setItem(name, value),
        removeItem: (name) => window.localStorage.removeItem(name),
      };
      session = new LocalFormDraft<unknown>(
        storage,
        { userId: this.userId, ...scope },
        codec,
        initial,
      );
      this.sessions.set(key, session);
    }
    return session as LocalFormDraft<T>;
  }

  hasUnsaved(): boolean {
    return [...this.sessions.values()].some((session) => session.getSnapshot().dirty);
  }
  deactivate(): void {
    this.sessions.forEach((session) => session.deactivate());
    this.sessions.clear();
  }
}

const DraftContext = createContext<DraftRegistry | null>(null);

export function devFormDraftsEnabled(env: Record<string, unknown>): boolean {
  return (
    env.VITE_LOCAL_FORM_DRAFTS_MODE === 'controlled' &&
    env.VITE_AUTH_MODE === 'supabase' &&
    env.VITE_SUPABASE_URL === 'https://vnmkupzptujtywnnabkp.supabase.co'
  );
}

export function FormDraftProvider({
  userId,
  enabled,
  children,
}: PropsWithChildren<{ userId: string | null; enabled: boolean }>) {
  const registry = useMemo(() => new DraftRegistry(userId, enabled), [userId, enabled]);
  const previous = useRef(registry);
  if (previous.current !== registry) {
    previous.current.deactivate();
    previous.current = registry;
  }
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (registry.hasUnsaved()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [registry]);
  // A changed identity remounts forms; previous-user inputs cannot remain visible.
  return (
    <DraftContext.Provider value={registry}>
      <Fragment key={enabled ? (userId ?? 'signed-out') : 'disabled'}>{children}</Fragment>
    </DraftContext.Provider>
  );
}

export function useLocalFormDraft<T>(
  scope: Omit<DraftScope, 'userId'>,
  codec: DraftCodec<T>,
  initial: T,
) {
  const registry = useContext(DraftContext);
  const session = registry?.open(scope, codec, initial) ?? null;
  const snapshot = useSyncExternalStore(
    session?.subscribe ?? (() => () => {}),
    session?.getSnapshot ?? (() => null),
  );
  useEffect(() => () => session?.suspend(), [session]);
  return { session, snapshot };
}
