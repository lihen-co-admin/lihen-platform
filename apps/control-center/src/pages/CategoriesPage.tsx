import { useEffect, useMemo, useState } from 'react';
import { createGetCategoriesQuery, type CategoryDTO } from '@lihen/products';
import { AdminPageHero } from '../components/AdminPageHero';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
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

  const metrics = useMemo(() => {
    const active = items.filter((item) => item.status === 'ACTIVE').length;
    const roots = items.filter((item) => item.parentId === null).length;
    const beauty = items.filter((item) => item.businessLine === 'BEAUTY_CARE').length;
    const style = items.filter((item) => item.businessLine === 'STYLE').length;
    return { active, roots, beauty, style };
  }, [items]);

  return (
    <section className="stack">
      <AdminPageHero
        title="Categorías"
        description="Taxonomía jerárquica del catálogo. Conserva business line y relaciones parent/child sin duplicar estructura por canal."
        accent="lilac"
        status={<span className="status-badge status-badge--success">Taxonomía canónica</span>}
      />

      <SummaryStrip items={[
        { label: 'Categorías', value: items.length },
        { label: 'Activas', value: metrics.active },
        { label: 'Raíz', value: metrics.roots },
        { label: 'Beauty Care', value: metrics.beauty, detail: `${metrics.style} Style` },
      ]} />

      <OperationalNotice title="Jerarquía compartida" meta="Product Master → Publishing">
        Las categorías se definen una vez y se reutilizan en producto, filtros, catálogos y storefront. Cambiar la taxonomía requiere preservar compatibilidad e historial.
      </OperationalNotice>

      {loading ? <div className="loading-card"><span className="loading-spinner" /><div><strong>Cargando categorías</strong><p>Resolviendo business line y jerarquías en DEV…</p></div></div> : null}
      {error ? <div className="error-state" role="alert">{error}</div> : null}
      {!loading && !error ? (
        <div className="table-card">
          <div className="table-summary"><strong>{items.length} categorías</strong><span>Jerarquía canónica · RLS activo</span></div>
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Categoría</th><th>Línea</th><th>Parent ID</th><th>Estado</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td><span className="line-badge">{item.businessLine === 'BEAUTY_CARE' ? 'Beauty Care' : 'Style'}</span></td><td className="code-text">{item.parentId ?? 'Raíz'}</td><td><span className={`product-status product-status--${item.status === 'ACTIVE' ? 'active' : 'inactive'}`}>{item.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}</span></td></tr>)}</tbody></table></div>
        </div>
      ) : null}
    </section>
  );
}
