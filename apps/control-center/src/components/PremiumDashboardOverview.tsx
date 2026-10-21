import { Link } from 'react-router-dom';
import { useLocalLabData } from '../domain/product-master-lab-data';
import type { OperationalDashboardSummary } from '../composition/operations';
import { PremiumCosmeticArtwork } from './PremiumCosmeticArtwork';
import { PremiumIcon } from './PremiumIcon';
/** Visual overview only: operational metrics are supplied by the existing query, never fixtures. */
export function PremiumDashboardOverview({
  summary,
}: {
  summary: OperationalDashboardSummary | null;
}) {
  const pilots = useLocalLabData();
  return (
    <div className="cc-dashboard-overview">
      <div className="cc-dashboard-merchandising">
        <section className="pm2-hero">
          <div className="pm2-hero-copy">
            <span className="pm2-kicker">LIHEN.CO | Beauty Care • Style</span>
            <h2>
              La belleza está
              <br />
              en cada detalle.
            </h2>
            <div className="pm2-hero-inset">
              <strong>Un universo, todas tus operaciones</strong>
              <p>
                Catálogo, inventario y decisiones
                <br />
                con información trazable.
              </p>
              <Link className="cc-hero-action" to="/products">
                Explorar productos <PremiumIcon name="arrow" />
              </Link>
            </div>
          </div>
          <PremiumCosmeticArtwork />
          <span className="pm2-hero-note">Ilustración original · sin producto comercial</span>
        </section>
        <div className="pm2-section-heading">
          <div>
            <span className="pm2-kicker">Product Master 2.0</span>
            <h2>Productos en revisión</h2>
          </div>
          <Link to="/products/lab">Abrir laboratorio →</Link>
        </div>
        <div className="pm2-product-grid">
          {pilots.products.length === 0 &&
            ['Beauty Care', 'Style'].map((line) => (
              <article className="pm2-product-card" key={line}>
                <div className="pm2-product-visual">
                  <span>SIN DATOS</span>
                </div>
                <h3>{line}</h3>
                <p>Sin selección local cargada</p>
              </article>
            ))}
          {pilots.products.map((p, index) => (
            <article key={p.id} className={`pm2-product-card pm2-product-card--${index}`}>
              <Link
                className="pm2-product-visual"
                to={`/products/lab?pilot=${p.sku}`}
                aria-label={`Revisar ${p.sku}`}
              >
                <span className="pm2-product-watermark">{index === 0 ? 'BEAUTY' : 'STYLE'}</span>
                <img src={p.images[0]?.url} alt={p.name} />
                <span className="pm2-edit-icon">
                  <PremiumIcon name="arrow" />
                </span>
              </Link>
              <div className="pm2-product-caption">
                <span className="pm2-kicker">{p.sku}</span>
                <h3>{p.name}</h3>
                <small>
                  Ensayo local{' '}
                  {new Date(pilots.readAt).toLocaleDateString('es-CO', {
                    timeZone: 'America/Bogota',
                  })}{' '}
                  · derechos pendientes
                </small>
              </div>
            </article>
          ))}
        </div>
      </div>
      <aside className="cc-dashboard-indicators">
        <section className="pm2-panel pm2-analytics">
          <h2>Lectura operativa</h2>
          <div
            className="pm2-empty-donut"
            role="img"
            aria-label={
              summary
                ? 'Indicadores consultados; sin serie histórica para graficar'
                : 'Sin datos operativos consultados'
            }
          >
            <span>
              <strong>{summary ? 'LECTURA' : 'SIN DATOS'}</strong>
              <small>Sin serie histórica verificada</small>
            </span>
          </div>
          <p>
            Las cifras operativas se consultan con el contrato existente. No se estiman porcentajes.
          </p>
        </section>
      </aside>
    </div>
  );
}
