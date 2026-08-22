import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.enabled) return <Outlet />;
  if (auth.loading || auth.authorizationLoading) {
    return <main className="auth-screen"><p>Validando sesión y autorización…</p></main>;
  }
  if (!auth.session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!auth.authorized) {
    return (
      <main className="auth-screen">
        <section className="auth-card" aria-labelledby="authorization-title">
          <p className="eyebrow">LIHEN Platform · DEV</p>
          <h1 id="authorization-title">Acceso no autorizado</h1>
          <p>La sesión existe, pero el perfil no está habilitado para entrar al Control Center.</p>
          <p><strong>Estado:</strong> {auth.profile?.authorizationStatus ?? 'SIN PERFIL'}</p>
          <p><strong>Rol:</strong> {auth.profile?.roleCode ?? '—'}</p>
          <button type="button" onClick={() => void auth.signOut()}>Cerrar sesión</button>
        </section>
      </main>
    );
  }
  return <Outlet />;
}
