import { useState } from 'react';
import { readSocialProviderReadiness, type SocialProviderReadiness as Report } from '../composition/social-provider-readiness';
export function SocialProviderReadiness({allowed}: {allowed:boolean}) {
  const [report,setReport] = useState<Report | null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  async function read() {
    if (!allowed || busy) return;
    setBusy(true); setError(''); setReport(null);
    try { setReport(await readSocialProviderReadiness()); }
    catch(cause) { setError(cause instanceof Error ? cause.message : 'Diagnóstico no disponible.'); }
    finally { setBusy(false); }
  }
  return <section className="card stack"><h2>Meta / TikTok · Diagnóstico de configuración</h2>
    <p>Consulta interna al runtime. Sin contactar proveedores ni mostrar valores secretos. REVIEW requiere validación posterior; la ejecución final permanece bloqueada.</p>
    <button disabled={!allowed || busy} onClick={() => void read()}>Consultar configuración server-side</button>
    {!report && !error && <p>Sin consultar: configuración desconocida.</p>}
    {error && <p role="alert">{error}</p>}
    {report?.providers.map(provider => <article key={provider.channel}><strong>{provider.channel}: {provider.status}</strong><p>{provider.blockers.join(' · ') || 'Configuración presente; proveedor no verificado.'}</p><small>{provider.restrictions.join(' · ')}</small></article>)}
  </section>;
}
