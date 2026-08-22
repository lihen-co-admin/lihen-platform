import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';

export function AppShell() {
  const auth = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <strong>LIHEN</strong>
          <span>Control Center · DEV</span>
        </div>

        <nav className="nav-list" aria-label="Navegación principal">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/products">Productos</NavLink>
          <NavLink to="/inventory">Inventario</NavLink>
          <NavLink to="/suppliers">Proveedores</NavLink>
          <NavLink to="/purchases">Compras</NavLink>
          <NavLink to="/orders">Pedidos</NavLink>
          <NavLink to="/sales">Ventas / POS</NavLink>
          <NavLink to="/finance">Caja y finanzas</NavLink>
          <NavLink to="/operations">Integridad y auditoría</NavLink>
          <NavLink to="/brands">Marcas</NavLink>
          <NavLink to="/categories">Categorías</NavLink>
          <NavLink to="/dev-auth-probe">DEV Auth Probe</NavLink>
        </nav>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-identity">
            <strong>LIHEN Control Center</strong>
            <small>{auth.user?.email ?? 'Sesión autenticada'} · {auth.profile?.roleCode ?? 'sin rol'}</small>
          </div>
          <button type="button" onClick={() => void auth.signOut()}>Cerrar sesión</button>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
