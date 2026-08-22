import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';

type NavItem = {
  readonly to: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly end?: boolean;
};

function NavIcon({ children }: { readonly children: ReactNode }) {
  return <span className="nav-icon" aria-hidden="true">{children}</span>;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Dashboard', end: true, icon: <NavIcon>⌂</NavIcon> },
  { to: '/products', label: 'Productos', icon: <NavIcon>▦</NavIcon> },
  { to: '/brands', label: 'Marcas', icon: <NavIcon>◆</NavIcon> },
  { to: '/categories', label: 'Categorías', icon: <NavIcon>≡</NavIcon> },
  { to: '/dev-auth-probe', label: 'Auth Probe', icon: <NavIcon>✓</NavIcon> },
];

export function AppShell() {
  const auth = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">L</div>
          <div>
            <strong>LIHEN</strong>
            <span>Control Center · DEV</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end ?? false}>
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="environment-dot" aria-hidden="true" />
          <span>Supabase DEV</span>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div className="session-copy">
            <strong>LIHEN Control Center</strong>
            <small>
              {auth.user?.email ?? 'Sesión autenticada'}
              <span aria-hidden="true"> · </span>
              {auth.profile?.roleCode ?? 'sin rol'}
            </small>
          </div>
          <button className="session-button" type="button" onClick={() => void auth.signOut()}>
            Cerrar sesión
          </button>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
