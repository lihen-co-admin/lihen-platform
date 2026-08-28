import { useEffect, useMemo, useState } from 'react';
import { createGetBrandsQuery, type BrandDTO } from '@lihen/products';
import { AdminPageHero } from '../components/AdminPageHero';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import { productsComposition } from '../composition/products';

export function BrandsPage() {
  const [items, setItems] = useState<readonly BrandDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    productsComposition.getBrands.execute(createGetBrandsQuery())
      .then((result) => { if (active) setItems(result); })
      .catch(() => { if (active) setError('No fue posible cargar las marcas canónicas.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const activeCount = useMemo(() => items.filter((item) => item.status === 'ACTIVE').length, [items]);

  return (
    <section className="stack">
      <AdminPageHero
        title="Marcas"
        description="Identidad comercial canónica para Product Master, catálogos y storefront. La lectura en DEV respeta Supabase y RLS."
        accent="pink"
        status={<span className="status-badge status-badge--success">Lectura canónica</span>}
      />

      <SummaryStrip items={[
        { label: 'Marcas canónicas', value: items.length },
        { label: 'Activas', value: activeCount },
        { label: 'Inactivas', value: Math.max(items.length - activeCount, 0) },
      ]} />

      <OperationalNotice title="Fuente de verdad" meta="Gobernada por Product Master + RLS">
        Marcas no debe duplicarse dentro de productos ni catálogos. Esta pantalla representa la taxonomía canónica compartida por los canales LIHEN.
      </OperationalNotice>

      {loading ? <div className="loading-card"><span className="loading-spinner" /><div><strong>Cargando marcas</strong><p>Consultando la taxonomía canónica en DEV…</p></div></div> : null}
      {error ? <div className="error-state" role="alert">{error}</div> : null}
      {!loading && !error ? (
        <div className="table-card">
          <div className="table-summary"><strong>{items.length} marcas</strong><span>Fuente canónica · solo lectura en esta slice</span></div>
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Marca</th><th>Nombre normalizado</th><th>Estado</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.normalizedName}</td><td><span className={`product-status product-status--${item.status === 'ACTIVE' ? 'active' : 'inactive'}`}>{item.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}</span></td></tr>)}</tbody></table></div>
        </div>
      ) : null}
    </section>
  );
}
