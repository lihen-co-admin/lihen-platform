import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';

export function BootstrapAdminPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!auth.enabled || (!auth.loading && auth.session)) return <Navigate to="/" replace />;
  if (!auth.bootstrapSignUpEnabled) return <Navigate to="/login" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 12) {
      setError('Usa una contraseña de al menos 12 caracteres para la cuenta administrativa DEV.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await auth.signUp(email.trim(), password);
      if (result.needsEmailConfirmation) {
        setMessage('Cuenta creada. Confirma el correo enviado por Supabase y luego inicia sesión.');
      } else {
        navigate('/products', { replace: true });
      }
    } catch {
      setError('No fue posible crear la cuenta DEV. Revisa el correo, la contraseña o la configuración Auth.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="bootstrap-title">
        <p className="eyebrow">LIHEN Platform · DEV · Bootstrap único</p>
        <h1 id="bootstrap-title">Crear primera cuenta DEV</h1>
        <p>
          Usa tu propio correo y una contraseña privada. Esta ruta debe deshabilitarse
          inmediatamente después de crear la primera cuenta.
        </p>
        <form onSubmit={submit} className="auth-form">
          <label>
            Correo administrativo DEV
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label>
            Confirmar contraseña
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
            />
          </label>
          {error ? <p role="alert" className="error-text">{error}</p> : null}
          {message ? <p role="status">{message}</p> : null}
          <button type="submit" disabled={submitting || auth.loading}>
            {submitting ? 'Creando…' : 'Crear cuenta DEV'}
          </button>
        </form>
        <small>
          Esta cuenta aún no representa un rol de autorización formal. No se usa user_metadata
          para decidir permisos. <Link to="/login">Volver al login</Link>.
        </small>
      </section>
    </main>
  );
}
