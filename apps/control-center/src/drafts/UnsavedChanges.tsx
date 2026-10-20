import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useBlocker } from 'react-router-dom';

const message =
  'Hay cambios sin guardar. Salir descartará el trabajo pendiente. ¿Deseas continuar?';
type Registration = (id: string, dirty: (() => boolean) | null) => void;
const Context = createContext<{ register: Registration; confirmLeave: () => boolean } | null>(null);

/** Warnings only: no form values, credentials or personal data enter browser storage. */
export function UnsavedChangesProvider({ children }: PropsWithChildren) {
  const [entries, setEntries] = useState<ReadonlyMap<string, () => boolean>>(new Map());
  const register = useCallback<Registration>((id, dirty) => {
    setEntries((previous) => {
      if (previous.get(id) === dirty || (!dirty && !previous.has(id))) return previous;
      const next = new Map(previous);
      if (dirty) next.set(id, dirty);
      else next.delete(id);
      return next;
    });
  }, []);
  const isDirty = () => [...entries.values()].some((read) => read());
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty() &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );
  const confirmLeave = () => !isDirty() || window.confirm(message);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (isDirty()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  });
  return (
    <Context.Provider value={{ register, confirmLeave }}>
      {children}
      {blocker.state === 'blocked' && (
        <dialog
          ref={(node) => {
            if (node && !node.open) node.showModal();
          }}
          onCancel={(event) => {
            event.preventDefault();
            blocker.reset();
          }}
          aria-label="Cambios sin guardar"
          className="card stack"
          style={{ maxWidth: '32rem', margin: 'auto', padding: '2rem' }}
        >
          <p>Hay cambios sin guardar. Salir descartará el trabajo pendiente.</p>
          <button type="button" autoFocus onClick={() => blocker.reset()}>
            Seguir trabajando
          </button>
          <button type="button" onClick={() => blocker.proceed()}>
            Descartar y salir
          </button>
        </dialog>
      )}
    </Context.Provider>
  );
}

export function useUnsavedChanges(dirty: boolean) {
  const context = useContext(Context);
  const id = useId();
  const pending = useRef(dirty);
  pending.current = dirty;
  useEffect(() => {
    context?.register(id, () => pending.current);
    return () => context?.register(id, null);
  }, [context?.register, id]);
  return {
    confirmDiscard: () => !context || !pending.current || window.confirm(message),
    markClean: () => {
      pending.current = false;
    },
  };
}

/** Baseline advances only on an explicit successful save or server load. */
export function useUnsavedValue(value: unknown) {
  const serialized = JSON.stringify(value);
  const [baseline, setBaseline] = useState(serialized);
  const latest = useRef(serialized);
  latest.current = serialized;
  const guard = useUnsavedChanges(serialized !== baseline);
  return {
    ...guard,
    markSaved: (saved?: unknown) => {
      guard.markClean();
      setBaseline(saved === undefined ? latest.current : JSON.stringify(saved));
    },
  };
}

export function useConfirmUnsavedExit() {
  return useContext(Context)?.confirmLeave ?? (() => true);
}
