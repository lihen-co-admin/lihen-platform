import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';

export function AppShell() {
  const auth = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <strong>LIHEN</strong>
          <small>Control Center · DEV</small>
        </div>
        <nav aria-label="Navegación principal">
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/products">Productos</NavLink>
          <NavLink to="/brands">Marcas</NavLink>
          <NavLink to="/categories">Categorías</NavLink>
          <NavLink to="/dev-auth-probe">DEV Auth Probe</NavLink>
        </nav>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <div>
            <strong>LIHEN Control Center</strong>
            <small>{auth.user?.email ?? 'Sesión autenticada'}</small>
          </div>
          <button type="button" onClick={() => void auth.signOut()}>Cerrar sesión</button>
        </header>
        <section className="app-content"><Outlet /></section>
      </div>
    </div>
  );
}
