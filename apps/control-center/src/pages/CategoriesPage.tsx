import { useEffect, useState } from 'react';
import { createGetCategoriesQuery, type CategoryDTO } from '@lihen/products';
import { PageHeader } from '../components/PageHeader';
import { productsComposition } from '../composition/products';

export function CategoriesPage() {
  const [items, setItems] = useState<readonly CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    productsComposition.getCategories.execute(createGetCategoriesQuery())
      .then((result) => { if (active) setItems(result); })
      .catch(() => { if (active) setError('No fue posible cargar las categorías canónicas.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <section>
      <PageHeader title="Categorías" description="FASE 2.2: lectura canónica de categories desde Supabase DEV, conservando business_line y parentId." />
      {loading ? <div className="empty-state">Cargando categorías…</div> : null}
      {error ? <div className="error-state" role="alert">{error}</div> : null}
      {!loading && !error ? (
        <div className="table-card"><div className="table-summary"><strong>{items.length} categorías canónicas</strong></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Categoría</th><th>Línea</th><th>Parent ID</th><th>Estado</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.businessLine}</td><td>{item.parentId ?? '—'}</td><td>{item.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}</td></tr>)}</tbody></table></div></div>
      ) : null}
    </section>
  );
}
