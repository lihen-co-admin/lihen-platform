import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);

  if (!auth.enabled || (!auth.loading && !auth.authorizationLoading && auth.session && auth.authorized)) return <Navigate to="/" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await auth.signIn(email.trim(), password);
      const destination = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(destination, { replace: true });
    } catch {
      setError('No fue posible iniciar sesión. Verifica las credenciales DEV.');
    } finally {
      setSubmitting(false);
    }
  }

  async function signInWithGitHub() {
    setError(null);
    setOauthSubmitting(true);
    try {
      await auth.signInWithGitHub(`${window.location.origin}/dev-auth-probe`);
    } catch {
      setError('No fue posible iniciar sesión con GitHub. Revisa la configuración OAuth DEV.');
      setOauthSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">LIHEN Platform · DEV</p>
        <h1 id="login-title">LIHEN Control Center</h1>
        <p>Acceso privado mediante Supabase Auth.</p>
        <button
          type="button"
          className="oauth-button"
          onClick={signInWithGitHub}
          disabled={oauthSubmitting || auth.loading || auth.authorizationLoading}
        >
          <span aria-hidden="true" className="oauth-button__icon">GH</span>
          {oauthSubmitting ? 'Abriendo GitHub…' : 'Continuar con GitHub'}
        </button>
        <div className="auth-divider"><span>o usa correo y contraseña</span></div>
        <form onSubmit={submit} className="auth-form">
          <label>
            Correo
            <input type="email" autoComplete="username" required value={email}
              onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Contraseña
            <input type="password" autoComplete="current-password" required value={password}
              onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error ? <p role="alert" className="error-text">{error}</p> : null}
          <button type="submit" disabled={submitting || auth.loading || auth.authorizationLoading}>
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
        <small>Acceso existente únicamente. {auth.bootstrapSignUpEnabled ? <><Link to="/bootstrap-admin">Crear primera cuenta DEV</Link> · deshabilitar después del bootstrap.</> : 'El alta DEV está deshabilitada.'}</small>
      </section>
    </main>
  );
}
