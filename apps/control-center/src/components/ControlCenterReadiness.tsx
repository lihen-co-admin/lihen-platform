import { configurationReadiness } from '../domain/configuration-readiness';

export function ControlCenterReadiness({ env, authorized, role, integrity }: {
  env: Record<string, unknown>; authorized: boolean; role: string | undefined;
  integrity: readonly { status: string; issueCount: number }[];
}) {
  const configuration = configurationReadiness(env);
  const operator = authorized && (role === 'OWNER' || role === 'ADMIN');
  const durable = operator && configuration.auth === 'supabase' && configuration.source === 'supabase' && configuration.credentialsPresent;
  const integrityState = !integrity.length ? 'REVIEW' : integrity.every(check => check.status === 'PASS' && check.issueCount === 0) ? 'READY' : 'BLOCKED';
  return <section className="card stack" aria-label="Control Center DEV readiness"><h2>CONTROL CENTER DEV READINESS</h2>
    <p>READY en configuración significa que las dependencias declaradas están presentes; no confirma RPC desplegadas, permisos efectivos ni operaciones comerciales.</p>
    <table><thead><tr><th>Capacidad</th><th>Estado</th><th>Evidencia / pendiente</th></tr></thead><tbody>
      {configuration.capabilities.map(row => <tr key={row.capability}><td>{row.capability}</td><td>{operator ? row.status : 'BLOCKED'}</td><td>{row.variable}: {row.mode} · fuente {configuration.source}</td></tr>)}
      <tr><td>AUTH OWNER/ADMIN</td><td>{durable ? 'READY' : 'BLOCKED'}</td><td>Sesión autorizada y configuración Supabase</td></tr>
      <tr><td>BONOS</td><td>{durable ? 'REVIEW' : 'BLOCKED'}</td><td>Verificar lectura y RPC desde Clientes / Bonos</td></tr>
      <tr><td>CONVERSACIONES</td><td>{durable ? 'REVIEW' : 'BLOCKED'}</td><td>Requiere migración de preparación y lectura durable; Sin enviar</td></tr>
      <tr><td>EDITORIAL</td><td>{durable && configuration.editorialSync === 'enabled' ? 'REVIEW' : 'BLOCKED'}</td><td>Sync {configuration.editorialSync}; confirmar lectura y guardado durable</td></tr>
      <tr><td>ASSISTANT / PROVIDERS</td><td>{durable ? 'REVIEW' : 'BLOCKED'}</td><td>El resultado real o el diagnóstico del runtime determina disponibilidad</td></tr>
      <tr><td>INTEGRIDAD OPERACIONAL</td><td>{integrityState}</td><td>{integrity.length} comprobaciones RPC recibidas</td></tr>
      <tr><td>EJECUCIÓN FINAL</td><td>BLOCKED</td><td>PROD HOLD · sin habilitar canary, dispatch, scheduler ni envío</td></tr>
    </tbody></table>
    <p>Producción no modificada por esta superficie. Las recomendaciones y aprobaciones no son ejecución.</p>
  </section>;
}
