import { useEffect, useState } from 'react';
import { createGetBrandsQuery, type BrandDTO } from '@lihen/products';
import { PageHeader } from '../components/PageHeader';
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

  return (
    <section>
      <PageHeader title="Marcas" description="FASE 2.2: lectura canónica de brands desde la fuente configurada; en DEV usa Supabase con RLS." />
      {loading ? <div className="empty-state">Cargando marcas…</div> : null}
      {error ? <div className="error-state" role="alert">{error}</div> : null}
      {!loading && !error ? (
        <div className="table-card"><div className="table-summary"><strong>{items.length} marcas canónicas</strong></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Marca</th><th>Nombre normalizado</th><th>Estado</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.normalizedName}</td><td>{item.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}</td></tr>)}</tbody></table></div></div>
      ) : null}
    </section>
  );
}
