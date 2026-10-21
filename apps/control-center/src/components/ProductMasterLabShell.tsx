import { useEffect, useRef, type PropsWithChildren } from 'react';
import { useModuleToolbar } from './ControlCenterShell';
export { CONTROL_CENTER_MODULES as LAB_MODULES } from '../domain/control-center-navigation';
export { PremiumIcon as LabIcon } from './PremiumIcon';
/** Toolbar adapter: the shared frame remains mounted across module navigation. */
export function ProductMasterLabShell({
  children,
  search,
  onSearch,
  confirmLeave,
}: PropsWithChildren<{
  search: string;
  onSearch: (value: string) => void;
  confirmLeave: () => boolean;
}>) {
  const register = useModuleToolbar();
  const latest = useRef({ search, onSearch, confirmLeave });
  latest.current = { search, onSearch, confirmLeave };
  useEffect(() => {
    if (!register) return;
    register({
      value: latest.current.search,
      onChange: (value) => latest.current.onSearch(value),
      confirmLeave: () => latest.current.confirmLeave(),
    });
    return () => register(null);
  }, [register]);
  useEffect(() => {
    register?.((previous) =>
      previous && previous.value !== search ? { ...previous, value: search } : previous,
    );
  }, [register, search]);
  return <>{children}</>;
}
