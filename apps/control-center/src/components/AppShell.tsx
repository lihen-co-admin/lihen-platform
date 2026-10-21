import { Link, Outlet, useLocation } from 'react-router-dom';
import { ControlCenterShell } from './ControlCenterShell';
import { CapabilityModeNotice } from './CapabilityModeNotice';
import { configurationReadiness } from '../domain/configuration-readiness';
import { THEMED_GROUPS, visualGroup } from '../domain/control-center-navigation';
import { PremiumIcon } from './PremiumIcon';
export function AppShell() {
  const location = useLocation();
  const configuration = configurationReadiness(import.meta.env);
  const group = visualGroup(location.pathname);
  const lab = location.pathname === '/products/lab';
  const themed =
    THEMED_GROUPS.includes(group) &&
    (group !== 'editorial' ||
      ['/content/public-hub', '/content/social', '/conversations'].includes(location.pathname)) &&
    (group !== 'intelligence' ||
      ['/cloud', '/assistant', '/operations'].includes(location.pathname));
  return (
    <ControlCenterShell
      developmentNavigation={
        import.meta.env.DEV ? (
          <details className="cc-dev-navigation">
            <summary aria-label="Rutas de desarrollo">
              <PremiumIcon name="shield" />
            </summary>
            <div>
              <Link to="/dev-auth-probe">Auth + RLS Probe</Link>
              <Link to="/dev-whatsapp-preflight">WhatsApp Preflight</Link>
            </div>
          </details>
        ) : null
      }
    >
      {!lab && (
        <div className="cc-mode-bar">
          <span className="cc-mode-critical">
            {configuration.source === 'memory'
              ? 'SIMULACIÓN · cambios locales no durables'
              : 'DEV · permisos y modos configurados'}
          </span>
          <details>
            <summary>Estado y permisos</summary>
            <div className="cc-mode-details">
              {configuration.source === 'memory' && (
                <p>SIMULACIÓN · Datos en memoria; los cambios no son durables en Supabase.</p>
              )}
              {configuration.auth === 'disabled' && (
                <p>Autenticación deshabilitada · preview local.</p>
              )}
              <CapabilityModeNotice pathname={location.pathname} env={import.meta.env} />
              <p>
                El diseño no confirma conectividad ni autoriza operaciones. Se mantienen las
                restricciones de cada módulo.
              </p>
            </div>
          </details>
        </div>
      )}
      <main
        className={`cc-module cc-module--${group}${themed && !lab ? ' cc-themed' : ''}${lab ? ' cc-module--lab' : ''}`}
        data-visual-group={group}
      >
        <Outlet />
      </main>
    </ControlCenterShell>
  );
}
