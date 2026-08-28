import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  createGetProductByIdQuery,
  createGetProductSalePriceHistoryQuery,
  createGetBrandsQuery,
  createGetCategoriesQuery,
  evaluateProductMasterReadiness,
  type ProductDetailDTO,
  type ProductSalePriceChangeDTO,
  type BrandDTO,
  type CategoryDTO,
} from '@lihen/products';
import { AdminPageHero } from '../components/AdminPageHero';
import { IntelligencePanel, type IntelligenceInsight } from '../components/IntelligencePanel';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import { productsComposition } from '../composition/products';

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusLabel(status: ProductDetailDTO['status']): string {
  return {
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
    DISCONTINUED: 'Descontinuado',
    ARCHIVED: 'Archivado',
  }[status];
}

export function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<ProductDetailDTO | null>(null);
  const [priceHistory, setPriceHistory] = useState<readonly ProductSalePriceChangeDTO[]>([]);
  const [brands, setBrands] = useState<readonly BrandDTO[]>([]);
  const [categories, setCategories] = useState<readonly CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!id) {
      setLoading(false);
      setNotFound(true);
      return () => {
        active = false;
      };
    }

    Promise.all([
      productsComposition.getProductById.execute(createGetProductByIdQuery(id)),
      productsComposition.canReadPriceHistory
        ? productsComposition.getProductSalePriceHistory.execute(
            createGetProductSalePriceHistoryQuery(id),
          )
        : Promise.resolve([]),
      productsComposition.getBrands.execute(createGetBrandsQuery()),
      productsComposition.getCategories.execute(createGetCategoriesQuery()),
    ])
      .then(([result, history, loadedBrands, loadedCategories]) => {
        if (!active) return;
        if (!result) {
          setNotFound(true);
          return;
        }
        setProduct(result);
        setPriceHistory(history);
        setBrands(loadedBrands);
        setCategories(loadedCategories);
      })
      .catch(() => {
        if (active) setError('No fue posible cargar el detalle del producto.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const masterReadiness = useMemo(() => {
    if (!product) return null;
    const brand = brands.find((item) => item.id === product.brandId);
    const category = categories.find((item) => item.id === product.categoryId);
    return evaluateProductMasterReadiness({
      businessLine: product.businessLine,
      ...(product.brandId ? { brandId: product.brandId } : {}),
      ...(brand ? { brandStatus: brand.status } : {}),
      ...(product.categoryId ? { categoryId: product.categoryId } : {}),
      ...(category ? { categoryStatus: category.status, categoryBusinessLine: category.businessLine } : {}),
      status: product.status,
    });
  }, [brands, categories, product]);

  const insights = useMemo<readonly IntelligenceInsight[]>(() => {
    if (!product) return [];
    const result: IntelligenceInsight[] = [];

    if (masterReadiness?.issues.includes('BRAND_REQUIRED')) {
      result.push({
        id: 'missing-brand',
        severity: 'WARNING',
        title: 'Marca canónica pendiente',
        explanation: 'El producto todavía no está asociado a una marca canónica. Completarla mejora filtros, catálogo y trazabilidad.',
        actionLabel: 'Editar producto',
        targetRoute: `/products/${product.id}/edit`,
        source: 'Product Master',
      });
    }

    if (masterReadiness?.issues.includes('CATEGORY_REQUIRED')) {
      result.push({
        id: 'missing-category',
        severity: 'WARNING',
        title: 'Categoría canónica pendiente',
        explanation: 'La categoría debe provenir de la taxonomía existente; LIHEN no inventa categorías para completar un producto.',
        actionLabel: 'Editar producto',
        targetRoute: `/products/${product.id}/edit`,
        source: 'Product Master + Taxonomía',
      });
    }

    if (masterReadiness?.issues.includes('BRAND_INACTIVE')) {
      result.push({
        id: 'inactive-brand', severity: 'WARNING', title: 'Marca canónica inactiva',
        explanation: 'La referencia histórica es válida, pero la identidad debe revisarse antes de tratar el producto como oferta vigente.',
        actionLabel: 'Revisar producto', targetRoute: `/products/${product.id}/edit`, source: 'Product Master readiness',
      });
    }

    if (masterReadiness?.issues.includes('CATEGORY_INACTIVE')) {
      result.push({
        id: 'inactive-category', severity: 'WARNING', title: 'Categoría canónica inactiva',
        explanation: 'La taxonomía histórica se conserva, pero una categoría inactiva no debe usarse como señal de readiness comercial.',
        actionLabel: 'Revisar taxonomía', targetRoute: `/products/${product.id}/edit`, source: 'Product Master readiness',
      });
    }

    if (masterReadiness?.issues.includes('CATEGORY_BUSINESS_LINE_MISMATCH')) {
      result.push({
        id: 'category-line-mismatch', severity: 'CRITICAL', title: 'Inconsistencia de línea y categoría',
        explanation: 'La categoría canónica pertenece a una línea de negocio diferente. El Product Master requiere corrección antes de cualquier evaluación de publicación.',
        actionLabel: 'Corregir producto', targetRoute: `/products/${product.id}/edit`, source: 'Product Master readiness',
      });
    }

    if (product.status !== 'ACTIVE') {
      result.push({
        id: 'lifecycle-state',
        severity: 'INFO',
        title: `Lifecycle: ${statusLabel(product.status)}`,
        explanation: 'El lifecycle lógico preserva la historia del Product Master. Inactivar, descontinuar o archivar no elimina referencias históricas.',
        source: 'Product lifecycle',
      });
    }

    if (priceHistory.length === 0) {
      result.push({
        id: 'price-history',
        severity: 'INFO',
        title: 'Sin cambios de precio registrados',
        explanation: 'El precio actual existe, pero esta fuente no reporta cambios históricos adicionales. Los futuros cambios deben seguir usando el flujo separado de pricing.',
        source: 'Price history',
      });
    }

    if (result.length === 0 && masterReadiness?.identityStatus === 'READY') {
      result.push({
        id: 'master-ready',
        severity: 'SUCCESS',
        title: 'Identidad canónica consistente',
        explanation: 'Nombre, marca, categoría y lifecycle están estructurados. La readiness de publicación seguirá dependiendo de precio, media y reglas de elegibilidad.',
        source: 'Product Master',
      });
    }

    return result;
  }, [masterReadiness, priceHistory.length, product]);

  return (
    <section>
      <AdminPageHero
        eyebrow="PRODUCT MASTER"
        title={product?.name ?? 'Detalle de producto'}
        description="Consulta la identidad canónica, lifecycle, pricing e historial del producto sin mezclar responsabilidades de inventario o publicación."
        accent="pink"
        actions={(
          <>
            <Link className="button-link button-link--secondary" to="/products">← Productos</Link>
            {id && productsComposition.canUpdate ? <Link className="button-link" to={`/products/${id}/edit`}>Editar</Link> : null}
            {id && productsComposition.canChangePrice ? <Link className="button-link" to={`/products/${id}/price`}>Cambiar precio</Link> : null}
            {id ? <Link className="button-link" to={`/products/${id}/images`}>Imágenes</Link> : null}
          </>
        )}
        status={product ? <span className="status-badge">{statusLabel(product.status)}</span> : undefined}
      />

      {loading ? <div className="empty-state">Cargando producto…</div> : null}
      {error ? <div className="error-state" role="alert">{error}</div> : null}

      {!loading && !error && notFound ? (
        <div className="empty-state">
          <strong>Producto no encontrado.</strong>
          <p>No existe un producto visible para el identificador solicitado.</p>
        </div>
      ) : null}

      {!loading && !error && product ? (
        <>
          <SummaryStrip
            items={[
              { label: 'Línea', value: product.businessLine === 'BEAUTY_CARE' ? 'Beauty Care' : 'Style' },
              { label: 'Precio', value: formatMoney(product.salePrice.amount, product.salePrice.currency) },
              { label: 'Marca', value: product.brandName ?? 'Pendiente' },
              { label: 'Categoría', value: product.categoryName ?? 'Pendiente' },
              { label: 'Master readiness', value: masterReadiness?.identityStatus ?? '—' },
              { label: 'Oferta', value: masterReadiness?.lifecycleStatus ?? '—' },
            ]}
          />

          <OperationalNotice title="Product Master preserva historia" tone="info" meta="Lifecycle lógico">
            <p>Las acciones de estado no deben convertirse en DELETE físico. El producto conserva su identidad y referencias aunque se inactive, descontinúe o archive.</p>
          </OperationalNotice>

          <IntelligencePanel insights={insights} description="Evalúa identidad canónica y lifecycle. No decide por sí sola la publicación en catálogo o storefront." />

          <div className="detail-card">
            <dl className="detail-grid">
              <div><dt>Nombre</dt><dd>{product.name}</dd></div>
              <div><dt>SKU</dt><dd>{product.sku ?? '—'}</dd></div>
              <div><dt>Código catálogo</dt><dd>{product.catalogCode ?? '—'}</dd></div>
              <div><dt>Slug</dt><dd>{product.slug}</dd></div>
              <div><dt>Marca canónica</dt><dd>{product.brandName ?? 'Pendiente normalización'}</dd></div>
              <div><dt>Categoría canónica</dt><dd>{product.categoryName ?? 'Pendiente normalización'}</dd></div>
              <div><dt>Estado</dt><dd>{statusLabel(product.status)}</dd></div>
              <div><dt>Fuente</dt><dd>{productsComposition.source === 'supabase' ? 'Supabase DEV' : 'Repositorio en memoria'}</dd></div>
            </dl>
          </div>

          <section className="detail-card" aria-labelledby="price-history-title">
            <h2 id="price-history-title">Historial de precio</h2>
            {!productsComposition.canReadPriceHistory ? (
              <p className="muted-text">La lectura persistente del historial está protegida por configuración y autorización.</p>
            ) : priceHistory.length === 0 ? (
              <p className="muted-text">No hay cambios de precio registrados en esta fuente.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Fecha</th><th>Anterior</th><th>Nuevo</th><th>Motivo</th><th>Actor</th></tr>
                  </thead>
                  <tbody>
                    {priceHistory.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDate(entry.changedAt)}</td>
                        <td>{formatMoney(entry.previousPrice.amount, entry.previousPrice.currency)}</td>
                        <td>{formatMoney(entry.newPrice.amount, entry.newPrice.currency)}</td>
                        <td>{entry.reason}</td>
                        <td>{entry.actorId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
