import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.enabled) return <Outlet />;
  if (auth.loading) return <main className="auth-screen"><p>Validando sesión…</p></main>;
  if (!auth.session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
