import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import logo from '../assets/brand/lihen-logo-official.png';

interface NavigationItem {
  readonly to: string;
  readonly label: string;
  readonly icon: string;
  readonly end?: boolean;
}

interface NavigationGroup {
  readonly label: string;
  readonly items: readonly NavigationItem[];
}

const navigation: readonly NavigationGroup[] = [
  { label: 'Inicio', items: [{ to: '/', label: 'Dashboard', icon: '⌂', end: true }] },
  {
    label: 'Catálogo',
    items: [
      { to: '/products', label: 'Productos', icon: '◇' },
      { to: '/brands', label: 'Marcas', icon: '✦' },
      { to: '/categories', label: 'Categorías', icon: '⌘' },
      { to: '/catalogs', label: 'Catálogos', icon: '▤' },
    ],
  },
  {
    label: 'Operación',
    items: [
      { to: '/inventory', label: 'Inventario', icon: '▦' },
      { to: '/suppliers', label: 'Proveedores', icon: '♢' },
      { to: '/purchases', label: 'Compras', icon: '↓' },
      { to: '/orders', label: 'Pedidos', icon: '◎' },
      { to: '/sales', label: 'Ventas / POS', icon: '◈' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { to: '/finance', label: 'Caja y finanzas', icon: '$' },
      { to: '/content/public-hub', label: 'Hub público', icon: '↗' },
    ],
  },
  {
    label: 'LIHEN Cloud',
    items: [{ to: '/cloud', label: 'Workspace', icon: '☁' }],
  },
  { label: 'Control', items: [{ to: '/operations', label: 'Integridad y auditoría', icon: '✓' }] },
];

export function AppShell() {
  const auth = useAuth();
  const isDev = import.meta.env.DEV;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark"><img src={logo} alt="" /></div>
          <div>
            <strong>LIHEN</strong>
            <span>Control Center · DEV</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navegación principal">
          {navigation.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group__label">{group.label}</span>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end ?? false}>
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}

          {isDev ? (
            <div className="nav-group nav-group--dev">
              <span className="nav-group__label">Desarrollo</span>
              <NavLink to="/dev-auth-probe">
                <span className="nav-icon" aria-hidden="true">⚙</span>
                <span>Auth + RLS Probe</span>
              </NavLink>
            </div>
          ) : null}
        </nav>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-identity">
            <span className="topbar-kicker">LIHEN CONTROL CENTER</span>
            <strong>Administración central</strong>
            <small>{auth.user?.email ?? 'Sesión autenticada'} · {auth.profile?.roleCode ?? 'sin rol'}</small>
          </div>
          <div className="topbar-actions">
            <span className="environment-pill">DEV seguro</span>
            <button type="button" className="button-ghost" onClick={() => void auth.signOut()}>Cerrar sesión</button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
