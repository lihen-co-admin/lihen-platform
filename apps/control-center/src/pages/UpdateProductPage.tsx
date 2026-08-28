import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BrandNotFoundError,
  CategoryNotFoundError,
  createGetBrandsQuery,
  createGetCategoriesQuery,
  createGetProductByIdQuery,
  createUpdateProductCommand,
  DuplicateCatalogCodeError,
  DuplicateProductSkuError,
  ProductNotFoundError,
  ProductUpdateForbiddenError,
  ProductWriteBlockedError,
  ProductWriteOperationConflictError,
  evaluateProductMasterReadiness,
  type BrandDTO,
  type BusinessLine,
  type CategoryDTO,
  type ProductStatus,
} from '@lihen/products';
import { useAuth } from '../auth/auth-context';
import { AdminPageHero } from '../components/AdminPageHero';
import { IntelligencePanel, type IntelligenceInsight } from '../components/IntelligencePanel';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import { productsComposition } from '../composition/products';

const STATUS_OPTIONS: readonly { value: ProductStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'DISCONTINUED', label: 'Descontinuado' },
  { value: 'ARCHIVED', label: 'Archivado' },
];

export function UpdateProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [sku, setSku] = useState('');
  const [catalogCode, setCatalogCode] = useState('');
  const [name, setName] = useState('');
  const [businessLine, setBusinessLine] = useState<BusinessLine>('BEAUTY_CARE');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brands, setBrands] = useState<readonly BrandDTO[]>([]);
  const [categories, setCategories] = useState<readonly CategoryDTO[]>([]);
  const [status, setStatus] = useState<ProductStatus>('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canUpdate = productsComposition.canUpdate && auth.authorized;

  useEffect(() => {
    let active = true;
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return () => { active = false; };
    }
    Promise.all([
      productsComposition.getProductById.execute(createGetProductByIdQuery(id)),
      productsComposition.getBrands.execute(createGetBrandsQuery()),
      productsComposition.getCategories.execute(createGetCategoriesQuery()),
    ])
      .then(([product, loadedBrands, loadedCategories]) => {
        if (!active) return;
        setBrands(loadedBrands);
        setCategories(loadedCategories);
        if (!product) {
          setNotFound(true);
          return;
        }
        setSku(product.sku ?? '');
        setCatalogCode(product.catalogCode ?? '');
        setName(product.name);
        setBusinessLine(product.businessLine);
        setBrandId(product.brandId ?? '');
        setCategoryId(product.categoryId ?? '');
        setStatus(product.status);
      })
      .catch(() => { if (active) setError('No fue posible cargar el producto para edición.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const selectedBrand = useMemo(() => brands.find((item) => item.id === brandId), [brandId, brands]);
  const selectedCategory = useMemo(() => categories.find((item) => item.id === categoryId), [categories, categoryId]);
  const masterReadiness = useMemo(() => evaluateProductMasterReadiness({
    businessLine,
    ...(brandId ? { brandId } : {}),
    ...(selectedBrand ? { brandStatus: selectedBrand.status } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(selectedCategory ? { categoryStatus: selectedCategory.status, categoryBusinessLine: selectedCategory.businessLine } : {}),
    status,
  }), [brandId, businessLine, categoryId, selectedBrand, selectedCategory, status]);

  const insights = useMemo<readonly IntelligenceInsight[]>(() => {
    const items: IntelligenceInsight[] = [];
    if (masterReadiness.issues.includes('BRAND_REQUIRED')) items.push({ id: 'brand', severity: 'WARNING', title: 'Marca pendiente', explanation: 'La edición puede cerrar este gap sin alterar precio, inventario ni historial.', source: 'Product Master readiness' });
    if (masterReadiness.issues.includes('BRAND_INACTIVE')) items.push({ id: 'brand-inactive', severity: 'WARNING', title: 'Marca canónica inactiva', explanation: 'La relación histórica se conserva, pero conviene revisar si el producto debe migrar a una marca activa antes de considerarlo listo para oferta.', source: 'Marca canónica' });
    if (masterReadiness.issues.includes('CATEGORY_REQUIRED')) items.push({ id: 'category', severity: 'WARNING', title: 'Categoría pendiente', explanation: 'Selecciona una categoría existente compatible con la línea de negocio.', source: 'Product Master readiness' });
    if (masterReadiness.issues.includes('CATEGORY_INACTIVE')) items.push({ id: 'category-inactive', severity: 'WARNING', title: 'Categoría canónica inactiva', explanation: 'La categoría se conserva por trazabilidad, pero ya no es elegible para nuevas asignaciones. Revisa la taxonomía antes de reactivar la oferta.', source: 'Taxonomía canónica' });
    if (masterReadiness.issues.includes('CATEGORY_BUSINESS_LINE_MISMATCH')) items.push({ id: 'category-line', severity: 'CRITICAL', title: 'Categoría incompatible con la línea', explanation: 'La categoría seleccionada pertenece a otra línea de negocio. Este estado no debe guardarse como identidad canónica.', source: 'Taxonomía canónica' });
    if (status === 'ARCHIVED') items.push({ id: 'archived', severity: 'INFO', title: 'Producto archivado', explanation: 'Archivar conserva la identidad histórica. No equivale a borrar físicamente el registro.', source: 'Lifecycle' });
    if (status === 'DISCONTINUED') items.push({ id: 'discontinued', severity: 'INFO', title: 'Producto descontinuado', explanation: 'El producto permanece trazable, pero su lifecycle indica que no debería tratarse como una oferta vigente.', source: 'Lifecycle' });
    if (items.length === 0) items.push({ id: 'consistent', severity: 'SUCCESS', title: 'Identidad lista para guardar', explanation: 'La edición mantiene separadas identidad, pricing, media e inventario.', source: 'Product Master' });
    return items;
  }, [masterReadiness, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!id || !canUpdate) {
      setError('La actualización controlada de Product Master no está habilitada para esta sesión.');
      return;
    }
    setSubmitting(true);
    try {
      const commandId = crypto.randomUUID();
      const result = await productsComposition.updateProduct.execute(createUpdateProductCommand({
        commandId,
        actorId: auth.user?.id ?? 'authenticated-session',
        requestedAt: new Date(),
        productId: id,
        ...(sku.trim() ? { sku } : {}),
        ...(catalogCode.trim() ? { catalogCode } : {}),
        name,
        businessLine,
        ...(brandId ? { brandId } : {}),
        ...(categoryId ? { categoryId } : {}),
        status,
      }));
      navigate(`/products/${result.id}`);
    } catch (caught) {
      if (caught instanceof DuplicateProductSkuError) setError('Ya existe otro producto con ese SKU.');
      else if (caught instanceof DuplicateCatalogCodeError) setError('Ya existe otro producto con ese código de catálogo.');
      else if (caught instanceof BrandNotFoundError) setError('La marca seleccionada ya no existe.');
      else if (caught instanceof CategoryNotFoundError) setError('La categoría seleccionada ya no existe.');
      else if (caught instanceof ProductNotFoundError) setNotFound(true);
      else if (caught instanceof ProductUpdateForbiddenError) setError('Tu perfil no está autorizado para actualizar productos.');
      else if (caught instanceof ProductWriteOperationConflictError) setError('La operación de actualización ya fue utilizada con otro contenido.');
      else if (caught instanceof ProductWriteBlockedError) setError('La actualización controlada permanece bloqueada en este entorno.');
      else setError('No fue posible actualizar el producto.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <AdminPageHero
        eyebrow="PRODUCT MASTER"
        title="Editar producto"
        description="Actualiza identidad, taxonomía y lifecycle. Pricing, media, inventario y publicación conservan sus flujos separados."
        accent="gold"
        actions={<Link className="button-link button-link--secondary" to={id ? `/products/${id}` : '/products'}>← Detalle</Link>}
        status={<span className="status-badge">CONTROLLED UPDATE</span>}
      />

      {!canUpdate ? (
        <OperationalNotice title="Actualización protegida" tone="warning">
          <p>La interfaz no habilita la escritura si la sesión o la configuración no cumplen el contrato de actualización controlada.</p>
        </OperationalNotice>
      ) : (
        <OperationalNotice title="Precio separado por diseño" tone="info">
          <p>El precio no se modifica desde este formulario. Su cambio usa un comando independiente para conservar historial y trazabilidad.</p>
        </OperationalNotice>
      )}

      {!loading && !notFound ? (
        <SummaryStrip
          items={[
            { label: 'Línea', value: businessLine === 'BEAUTY_CARE' ? 'Beauty Care' : 'Style' },
            { label: 'Identidad', value: masterReadiness.identityStatus },
            { label: 'Lifecycle', value: masterReadiness.lifecycleStatus },
            { label: 'Taxonomía', value: `${masterReadiness.issues.length} pendiente${masterReadiness.issues.length === 1 ? '' : 's'}` },
          ]}
        />
      ) : null}

      <IntelligencePanel insights={insights} description="Evalúa consistencia canónica y lifecycle sin confundir Product Master con publicación." />

      {loading ? <div className="empty-state">Cargando producto…</div> : null}
      {notFound && !loading ? <div className="empty-state"><strong>Producto no encontrado.</strong></div> : null}

      {!loading && !notFound ? (
        <form className="product-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label><span>Nombre *</span><input value={name} onChange={(event) => setName(event.target.value)} required disabled={!canUpdate || submitting} /></label>
            <label><span>Línea de negocio</span><select value={businessLine} disabled><option value="BEAUTY_CARE">Beauty Care</option><option value="STYLE">Style</option></select></label>
            <label><span>SKU</span><input value={sku} onChange={(event) => setSku(event.target.value)} disabled={!canUpdate || submitting} /></label>
            <label><span>Código catálogo</span><input value={catalogCode} onChange={(event) => setCatalogCode(event.target.value)} disabled={!canUpdate || submitting} /></label>
            <label>
              <span>Marca canónica</span>
              <select value={brandId} onChange={(event) => setBrandId(event.target.value)} disabled={!canUpdate || submitting}>
                <option value="">Sin asignar</option>
                {brands.filter((item) => item.status === 'ACTIVE' || item.id === brandId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              <span>Categoría canónica</span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={!canUpdate || submitting}>
                <option value="">Sin asignar</option>
                {categories.filter((item) => (item.status === 'ACTIVE' && item.businessLine === businessLine) || item.id === categoryId).map((item) => <option key={item.id} value={item.id}>{item.name}{item.status === 'INACTIVE' ? ' (inactiva)' : ''}{item.businessLine !== businessLine ? ' · línea incompatible' : ''}</option>)}
              </select>
            </label>
            <label>
              <span>Lifecycle</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as ProductStatus)} disabled={!canUpdate || submitting}>
                {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>
          {error ? <div className="error-state" role="alert">{error}</div> : null}
          <div className="form-actions">
            <Link className="button-link button-link--secondary" to={id ? `/products/${id}` : '/products'}>Cancelar</Link>
            <button type="submit" disabled={!canUpdate || submitting}>{submitting ? 'Guardando…' : 'Guardar Product Master'}</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
