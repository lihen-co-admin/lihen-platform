import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { useConfirmUnsavedExit } from '../drafts/UnsavedChanges';
import { CONTROL_CENTER_MODULES } from '../domain/control-center-navigation';
import { PremiumIcon as LabIcon } from './PremiumIcon';
import logo from '../assets/brand/lihen-logo-official.png';
import '../styles/control-center-premium.css';
export interface ModuleToolbar {
  value: string;
  onChange: (value: string) => void;
  confirmLeave: () => boolean;
}
const ToolbarContext = createContext<Dispatch<SetStateAction<ModuleToolbar | null>> | null>(null);
export function useModuleToolbar() {
  return useContext(ToolbarContext);
}
export function ControlCenterShell({
  children,
  developmentNavigation,
}: PropsWithChildren<{ developmentNavigation?: React.ReactNode }>) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [toolbar, setToolbar] = useState<ModuleToolbar | null>(null);
  const auth = useAuth();
  const location = useLocation();
  const confirmExit = useConfirmUnsavedExit();
  const filtered = useMemo(
    () =>
      CONTROL_CENTER_MODULES.filter(([, label]) =>
        label.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')),
      ),
    [query],
  );
  const confirmLeave = () => toolbar?.confirmLeave() ?? true;
  return (
    <ToolbarContext.Provider value={setToolbar}>
      <div className="pm2-backdrop">
        <div className={`pm2-shell cc-frame${expanded ? ' pm2-shell--expanded' : ''}`}>
          <aside className="pm2-rail">
            <Link
              to="/"
              className="pm2-logo"
              aria-label="LIHEN.CO · Inicio"
              onClick={(e) => {
                if (!confirmLeave()) e.preventDefault();
              }}
            >
              <img src={logo} alt="Logo oficial LIHEN.CO" />
            </Link>
            <button
              type="button"
              className="pm2-rail-toggle"
              aria-label={expanded ? 'Contraer navegación' : 'Expandir navegación'}
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              <LabIcon name="menu" />
              {expanded && <span>Módulos</span>}
            </button>
            <nav aria-label="Módulos de LIHEN.CO">
              {CONTROL_CENTER_MODULES.map(([to, label, icon]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  title={label}
                  aria-label={label}
                  onClick={(e) => {
                    if (!confirmLeave()) e.preventDefault();
                  }}
                  className={({ isActive }) => (isActive ? 'is-current' : '')}
                >
                  <LabIcon name={icon} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
            {developmentNavigation}
            <small className="pm2-rail-foot">DEV</small>
          </aside>
          <div className="pm2-workspace">
            <header className="pm2-topbar">
              <div>
                <span className="cc-brandline">LIHEN CONTROL CENTER</span>
                <h1 className="cc-welcome">
                  Hola, bienvenida <span aria-hidden="true">✧</span>
                </h1>
                <p>Tu universo LIHEN, en un solo lugar.</p>
              </div>
              <div className="cc-shell-search">
                <label className="pm2-search">
                  <LabIcon name="search" />
                  <input
                    aria-label={toolbar ? 'Buscar productos' : 'Buscar módulos'}
                    placeholder={
                      toolbar
                        ? 'Buscar productos, SKU o referencia…'
                        : 'Buscar módulos de Control Center…'
                    }
                    value={toolbar?.value ?? query}
                    onChange={(e) =>
                      toolbar ? toolbar.onChange(e.target.value) : setQuery(e.target.value)
                    }
                  />
                </label>
                {!toolbar && query.trim() && (
                  <nav className="cc-search-results" aria-label="Resultados de búsqueda de módulos">
                    {filtered.length ? (
                      filtered.map(([to, label]) => (
                        <Link key={to} to={to} onClick={() => setQuery('')}>
                          {label}
                        </Link>
                      ))
                    ) : (
                      <p>No hay módulos con ese nombre.</p>
                    )}
                  </nav>
                )}
              </div>
              <details className="pm2-alert">
                <summary aria-label="Alertas de Control Center">
                  <LabIcon name="bell" />
                  <i />
                </summary>
                <p>
                  Consulta Estado y permisos para los modos configurados. La apariencia no confirma
                  persistencia ni habilita operaciones.
                </p>
              </details>
              <details className="pm2-profile">
                <summary>
                  <span className="pm2-avatar">L</span>
                  <span>
                    <strong>{auth.profile?.displayName ?? 'Propietaria LIHEN'}</strong>
                    <small>
                      {auth.enabled
                        ? (auth.profile?.roleCode ?? 'Sin rol confirmado')
                        : 'Sesión local · sin autenticar'}
                    </small>
                  </span>
                  <span aria-hidden="true">⌄</span>
                </summary>
                <button
                  type="button"
                  onClick={() => {
                    if (toolbar ? toolbar.confirmLeave() : confirmExit()) void auth.signOut();
                  }}
                >
                  Cerrar sesión
                </button>
              </details>
            </header>
            <div className="cc-current-module" aria-live="polite">
              {CONTROL_CENTER_MODULES.find(([to]) =>
                to === '/'
                  ? location.pathname === '/'
                  : location.pathname === to || location.pathname.startsWith(to + '/'),
              )?.[1] ?? 'Control Center'}
            </div>
            {children}
          </div>
        </div>
      </div>
    </ToolbarContext.Provider>
  );
}
