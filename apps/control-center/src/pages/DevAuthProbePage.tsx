import { useState } from 'react';
import { createGetProductsQuery } from '@lihen/products';
import { useAuth } from '../auth/auth-context';
import { PageHeader } from '../components/PageHeader';
import { productsComposition } from '../composition/products';

type ProbeStatus = 'IDLE' | 'RUNNING' | 'PASS' | 'FAIL';

interface ProbeResult {
  readonly status: ProbeStatus;
  readonly tokenFingerprint?: string;
  readonly userId?: string;
  readonly email?: string;
  readonly productCount?: number;
  readonly message?: string;
}

async function fingerprint(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

export function DevAuthProbePage() {
  const auth = useAuth();
  const [result, setResult] = useState<ProbeResult>({ status: 'IDLE' });

  async function runProbe() {
    setResult({ status: 'RUNNING' });

    try {
      if (!auth.session?.access_token || !auth.user) {
        throw new Error('No existe una sesión Supabase autenticada.');
      }
      if (productsComposition.source !== 'supabase') {
        throw new Error('El ProductRepository no está configurado para Supabase DEV.');
      }

      const tokenFingerprint = await fingerprint(auth.session.access_token);
      const products = await productsComposition.getProducts.execute(createGetProductsQuery());

      setResult({
        status: 'PASS',
        tokenFingerprint,
        userId: auth.user.id,
        ...(auth.user.email ? { email: auth.user.email } : {}),
        productCount: products.length,
        message: 'JWT presente y GetProducts fue autorizado por RLS en Supabase DEV.',
      });
    } catch (error) {
      setResult({
        status: 'FAIL',
        message: error instanceof Error ? error.message : 'Falló el probe de Auth/RLS.',
      });
    }
  }

  return (
    <div>
      <PageHeader
        title="DEV Auth + RLS Probe"
        description="Comprueba sesión real, JWT presente y lectura de products mediante el adapter Supabase. El token nunca se muestra."
      />

      <div className="card stack">
        <p><strong>Auth:</strong> {auth.enabled ? 'Supabase' : 'deshabilitado'}</p>
        <p><strong>Fuente Products:</strong> {productsComposition.source}</p>
        <p><strong>Usuario:</strong> {auth.user?.email ?? 'sin sesión'}</p>
        <button type="button" onClick={() => void runProbe()} disabled={result.status === 'RUNNING'}>
          {result.status === 'RUNNING' ? 'Ejecutando…' : 'Ejecutar probe real'}
        </button>
      </div>

      {result.status === 'PASS' && (
        <div className="card stack" role="status" data-testid="auth-probe-pass">
          <h2>PASS</h2>
          <p>{result.message}</p>
          <p><strong>User ID:</strong> {result.userId}</p>
          <p><strong>Email:</strong> {result.email}</p>
          <p><strong>Huella JWT:</strong> {result.tokenFingerprint}</p>
          <p><strong>Productos leídos:</strong> {result.productCount}</p>
          <small>La huella SHA-256 identifica la sesión sin revelar el access token.</small>
        </div>
      )}

      {result.status === 'FAIL' && (
        <div className="card stack" role="alert" data-testid="auth-probe-fail">
          <h2>FAIL</h2>
          <p>{result.message}</p>
        </div>
      )}
    </div>
  );
}
