import { useState } from 'react';
import {
  readSocialProviderReadiness,
  readMetaAccountVerification,
  readTikTokAccount,
  type MetaAccountVerification,
  type SocialProviderReadiness as Report,
} from '../composition/social-provider-readiness';
export function SocialProviderReadiness({ allowed }: { allowed: boolean }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<MetaAccountVerification | null>(null);
  const [tikTokAccount, setTikTokAccount] = useState<Awaited<
    ReturnType<typeof readTikTokAccount>
  > | null>(null);
  async function verifyAccounts() {
    if (!allowed || busy) return;
    setBusy(true);
    setError('');
    setAccounts(null);
    try {
      setAccounts(await readMetaAccountVerification());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se confirmó el acceso a Meta.');
    } finally {
      setBusy(false);
    }
  }
  async function read() {
    if (!allowed || busy) return;
    setBusy(true);
    setError('');
    setReport(null);
    try {
      setReport(await readSocialProviderReadiness());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Diagnóstico no disponible.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card stack">
      <h2>Meta / TikTok · Diagnóstico de configuración</h2>
      <p>
        Configuración: consulta interna sin contactar proveedores. Verificación Meta: consultas
        oficiales de solo lectura con sesión OWNER/ADMIN. Ninguna de las dos habilita publicaciones.
      </p>
      <button disabled={!allowed || busy} onClick={() => void read()}>
        Consultar configuración server-side
      </button>
      <button disabled={!allowed || busy} onClick={() => void verifyAccounts()}>
        Verificar cuentas y permisos Meta · solo lectura
      </button>
      <button
        disabled={!allowed || busy}
        onClick={async () => {
          if (!allowed || busy) return;
          setBusy(true);
          setError('');
          setTikTokAccount(null);
          try {
            setTikTokAccount(await readTikTokAccount());
          } catch {
            setError(
              'TikTok: lectura no confirmada. Requiere runtime DEV, autorización oficial y TIKTOK_DIAGNOSTICS_ENABLED; publicación continúa bloqueada.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Consultar cuenta TikTok · sin publicar
      </button>
      {tikTokAccount && (
        <p>
          Cuenta TikTok consultada: {tikTokAccount.nickname ?? tikTokAccount.accountId}.
          Consentimiento por contenido pendiente; publicación no habilitada.
        </p>
      )}
      <a href="#/dev-whatsapp-preflight">Verificar coexistencia WhatsApp · sin enviar</a>
      <p>
        Las variables configuradas no confirman una cuenta conectada. La verificación realiza
        únicamente consultas oficiales; no publica ni envía mensajes.
      </p>
      <details>
        <summary>Conectar Meta: acción de la propietaria</summary>
        <p>
          Flujo admitido: Facebook Login. En la herramienta oficial selecciona la aplicación LIHEN y
          tu usuario administrador de la página. Solicita pages_show_list, pages_read_engagement,
          pages_manage_posts, instagram_basic e instagram_content_publish. Autoriza expresamente la
          página LIHEN y la cuenta profesional Instagram vinculada.
        </p>
        <a
          href="https://developers.facebook.com/tools/explorer/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir autorización oficial Meta
        </a>
        <p>
          Comprueba mediante GET me/accounts?fields=id,tasks,instagram_business_account los
          identificadores y tareas autorizadas. No pegues tokens en Control Center, chats ni
          archivos. La configuración de secretos DEV requiere una operación administrada y
          autorizada por separado. Si la app no ofrece esos permisos, debe habilitar su caso de uso
          y obtener el acceso que Meta exija; no utilices el token de WhatsApp.
        </p>
        <p>
          Después de configurar las credenciales correctas, vuelve a verificar cuentas y permisos.
          Borradores, aprobación y calendario editorial se gestionan por separado; programar no
          publica automáticamente.
        </p>
      </details>
      {accounts?.accounts.map((account) => (
        <article key={account.channel}>
          <strong>{account.channel}</strong>
          <p>
            Acceso a cuenta: {account.accountVerified ? 'verificado' : 'no verificado'}. Permisos
            consultados: {account.permissionsVerified ? 'concedidos' : 'no verificados'}.
          </p>
          <p>{account.blockers.join(' · ')}</p>
          <small>
            La elegibilidad de la cuenta y revisión de la app siguen pendientes; este resultado no
            autoriza publicaciones.
          </small>
        </article>
      ))}
      <p>
        TikTok y WhatsApp: HOLD. Carruseles y atención de mensajes/comentarios requieren contratos y
        permisos específicos; no están habilitados por esta comprobación.
      </p>
      {!report && !error && <p>Sin consultar: configuración desconocida.</p>}
      {error && <p role="alert">{error}</p>}
      {report?.providers.map((provider) => (
        <article key={provider.channel}>
          <strong>
            {provider.channel}: {provider.status}
          </strong>
          <p>
            {provider.blockers.join(' · ') || 'Configuración presente; proveedor no verificado.'}
          </p>
          <small>{provider.restrictions.join(' · ')}</small>
        </article>
      ))}
    </section>
  );
}
