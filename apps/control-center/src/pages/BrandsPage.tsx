import { useEffect, useMemo, useState } from 'react';
import { createGetBrandsQuery, type BrandDTO } from '@lihen/products';
import { AdminPageHero } from '../components/AdminPageHero';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import { productsComposition } from '../composition/products';
import { buildBrandWorkspaceReadModel } from '../read-models/brand-workspace';

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

  const workspace = useMemo(() => buildBrandWorkspaceReadModel(items), [items]);

  return (
    <section className="stack">
      <AdminPageHero
        title="Brand Workspace"
        description="Identidad comercial canónica, gobierno visual y preparación para revisión humana. La pantalla observa y organiza; no muta Brand Master ni Brand Assets directamente."
        accent="pink"
        status={<span className="status-badge status-badge--success">Workspace gobernado</span>}
      />

      <SummaryStrip items={[
        { label: 'Marcas canónicas', value: workspace.total },
        { label: 'Activas', value: workspace.active },
        { label: 'Inactivas', value: workspace.inactive },
        { label: 'Identidad protegida', value: workspace.protectedByGovernance },
      ]} />

      <OperationalNotice title="Fuente de verdad" meta="Brand Master + Brand Assets · sin identidad paralela">
        Brand Master conserva la identidad comercial. Brand Assets 1:N es la foundation canónica para LOGO, WORDMARK, ISOTYPE y LOCKUP. El campo histórico brands.logo_url puede seguir sirviendo a proyecciones compatibles, pero esta pantalla no lo eleva a una segunda fuente de verdad.
      </OperationalNotice>

      <OperationalNotice title="Frontera de ejecución" meta="Intelligence propone · LIHEN Platform autoriza">
        Brand Intelligence puede preparar Evidence, Candidate y Recommendation. Cualquier cambio canónico sigue requiriendo revisión humana y Existing Control Plane. MANUAL_VERIFIED no puede reemplazarse silenciosamente.
      </OperationalNotice>

      {loading ? <div className="loading-card"><span className="loading-spinner" /><div><strong>Cargando marcas</strong><p>Consultando Brand Master en DEV…</p></div></div> : null}
      {error ? <div className="error-state" role="alert">{error}</div> : null}

      {!loading && !error ? (
        <>
          <div className="table-card">
            <div className="table-summary">
              <strong>{workspace.total} marcas</strong>
              <span>Brand Master · lectura canónica</span>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Marca</th>
                    <th>Nombre normalizado</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.items.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.name}</strong></td>
                      <td>{item.normalizedName}</td>
                      <td>
                        <span className={`product-status product-status--${item.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                          {item.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="table-card">
            <div className="table-summary">
              <strong>Gobierno de identidad visual</strong>
              <span>GAP-015 + GAP-016 + Unified Human Review Queue</span>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Marca</th>
                    <th>Brand Assets</th>
                    <th>Manual override</th>
                    <th>Revisión</th>
                    <th>Mutación canónica</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.items.map((item) => (
                    <tr key={`workspace:${item.id}`}>
                      <td><strong>{item.name}</strong></td>
                      <td>{item.assetFoundationLabel}</td>
                      <td>{item.manualProtectionLabel}</td>
                      <td>{item.reviewBoundaryLabel}</td>
                      <td>{item.mutationBoundaryLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <OperationalNotice title="Estado físico actual" meta="DEV · observación explícita">
            La foundation de Brand Assets e Intelligence ya está formalizada en código, pero DEV todavía no tiene persistencia Brand Assets 1:N ni una operación Brand/Brand Asset registrada en el Existing Control Plane. Por eso este workspace no presenta botones falsos de aprobar, reemplazar o guardar identidad.
          </OperationalNotice>
        </>
      ) : null}
    </section>
  );
}
