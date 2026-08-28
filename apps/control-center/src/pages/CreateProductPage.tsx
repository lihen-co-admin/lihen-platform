import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BrandNotFoundError,
  CategoryNotFoundError,
  createCreateProductCommand,
  createGetBrandsQuery,
  createGetCategoriesQuery,
  DuplicateCatalogCodeError,
  DuplicateProductSkuError,
  ProductCreateForbiddenError,
  ProductWriteBlockedError,
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

export function CreateProductPage() {
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
  const [salePrice, setSalePrice] = useState('');
  const [status, setStatus] = useState<ProductStatus>('INACTIVE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canCreate = productsComposition.canCreate && auth.authorized;

  useEffect(() => {
    Promise.all([
      productsComposition.getBrands.execute(createGetBrandsQuery()),
      productsComposition.getCategories.execute(createGetCategoriesQuery()),
    ])
      .then(([loadedBrands, loadedCategories]) => {
        setBrands(loadedBrands);
        setCategories(loadedCategories);
      })
      .catch(() => setError('No fue posible cargar marcas y categorías canónicas desde Supabase DEV.'));
  }, []);

  const eligibleCategories = useMemo(
    () => categories.filter((item) => item.status === 'ACTIVE' && item.businessLine === businessLine),
    [businessLine, categories],
  );

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
    if (masterReadiness.issues.includes('BRAND_REQUIRED')) items.push({ id: 'brand', severity: 'INFO', title: 'Marca todavía sin asignar', explanation: 'Puede crearse sin marca, pero la identidad canónica seguirá incompleta hasta asociar una marca existente.', source: 'Product Master readiness' });
    if (masterReadiness.issues.includes('CATEGORY_REQUIRED')) items.push({ id: 'category', severity: 'INFO', title: 'Categoría todavía sin asignar', explanation: 'LIHEN no inventará categorías. Selecciona únicamente una categoría canónica compatible con la línea de negocio.', source: 'Product Master readiness' });
    if (businessLine === 'STYLE' && eligibleCategories.length === 0) items.push({ id: 'style-taxonomy', severity: 'WARNING', title: 'STYLE sin categoría elegible', explanation: 'No debe crearse una categoría improvisada para completar el alta. Primero debe existir taxonomía canónica válida.', source: 'Categorías' });
    if (status === 'ACTIVE') items.push({ id: 'active-start', severity: 'WARNING', title: 'Inicio en estado Activo', explanation: 'Crear un producto activo no lo publica automáticamente, pero aumenta el riesgo de asumir readiness antes de completar media y taxonomía.', source: 'Lifecycle' });
    if (items.length === 0) items.push({ id: 'safe-draft', severity: 'SUCCESS', title: 'Alta preparada de forma conservadora', explanation: 'El producto se creará con identidad canónica y lifecycle controlado. Inventario, imágenes y publicación siguen siendo responsabilidades separadas.', source: 'Product Master' });
    return items;
  }, [businessLine, eligibleCategories.length, masterReadiness, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!canCreate) {
      setError('La creación controlada no está habilitada para esta sesión.');
      return;
    }

    const numericPrice = Number(salePrice);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      setError('Ingresa un precio válido mayor o igual a 0.');
      return;
    }

    if (businessLine === 'STYLE' && eligibleCategories.length === 0) {
      setError('STYLE todavía no tiene taxonomía canónica disponible. No se creará una categoría inventada.');
      return;
    }

    setSubmitting(true);
    try {
      const commandId = crypto.randomUUID();
      const result = await productsComposition.createProduct.execute(
        createCreateProductCommand({
          commandId,
          actorId: auth.user?.id ?? 'authenticated-session',
          requestedAt: new Date(),
          operationKey: `product-master:create:${commandId}`,
          ...(sku.trim() ? { sku } : {}),
          ...(catalogCode.trim() ? { catalogCode } : {}),
          name,
          businessLine,
          ...(brandId ? { brandId } : {}),
          ...(categoryId ? { categoryId } : {}),
          status,
          salePrice: numericPrice,
        }),
      );
      navigate(`/products/${result.id}`);
    } catch (caught) {
      if (caught instanceof DuplicateProductSkuError) setError('Ya existe un producto con ese SKU.');
      else if (caught instanceof DuplicateCatalogCodeError) setError('Ya existe un producto con ese código de catálogo.');
      else if (caught instanceof BrandNotFoundError) setError('La marca seleccionada ya no existe.');
      else if (caught instanceof CategoryNotFoundError) setError('La categoría seleccionada ya no existe.');
      else if (caught instanceof ProductCreateForbiddenError) setError('Tu perfil no tiene autorización OWNER/ADMIN para crear productos.');
      else if (caught instanceof ProductWriteBlockedError) setError('La creación controlada permanece bloqueada en este entorno.');
      else setError('No fue posible crear el producto. Revisa los datos e inténtalo nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <AdminPageHero
        eyebrow="PRODUCT MASTER"
        title="Nuevo producto"
        description="Crea la identidad canónica del producto. Inventario, media, publicación y cambios posteriores de precio permanecen separados y trazables."
        accent="lilac"
        actions={<Link className="button-link button-link--secondary" to="/products">← Productos</Link>}
        status={<span className="status-badge">CONTROLLED WRITE</span>}
      />

      {!canCreate ? (
        <OperationalNotice title="Creación protegida" tone="warning" meta="Auth + OWNER/ADMIN + feature flag">
          <p>La UI puede preparar el formulario, pero la escritura solo se habilita cuando la sesión y la configuración cumplen el contrato controlado.</p>
        </OperationalNotice>
      ) : (
        <OperationalNotice title="Separación de responsabilidades" tone="success">
          <p>Crear el Product Master no publica el producto, no asigna inventario y no agrega imágenes automáticamente.</p>
        </OperationalNotice>
      )}

      <SummaryStrip
        items={[
          { label: 'Línea', value: businessLine === 'BEAUTY_CARE' ? 'Beauty Care' : 'Style' },
          { label: 'Identidad', value: masterReadiness.identityStatus },
          { label: 'Lifecycle', value: masterReadiness.lifecycleStatus },
          { label: 'Taxonomía', value: `${masterReadiness.issues.length} pendiente${masterReadiness.issues.length === 1 ? '' : 's'}` },
        ]}
      />

      <IntelligencePanel insights={insights} description="Evalúa consistencia del Product Master. No sustituye media, precio, snapshot ni gates de publicación." />

      <form className="product-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label><span>Nombre *</span><input value={name} onChange={(event) => setName(event.target.value)} required disabled={!canCreate || submitting} /></label>
          <label>
            <span>Línea de negocio *</span>
            <select value={businessLine} onChange={(event) => { setBusinessLine(event.target.value as BusinessLine); setCategoryId(''); }} disabled={!canCreate || submitting}>
              <option value="BEAUTY_CARE">Beauty Care</option>
              <option value="STYLE">Style</option>
            </select>
          </label>
          <label><span>SKU</span><input value={sku} onChange={(event) => setSku(event.target.value)} disabled={!canCreate || submitting} /></label>
          <label><span>Código catálogo</span><input value={catalogCode} onChange={(event) => setCatalogCode(event.target.value)} disabled={!canCreate || submitting} /></label>
          <label>
            <span>Marca canónica</span>
            <select value={brandId} onChange={(event) => setBrandId(event.target.value)} disabled={!canCreate || submitting}>
              <option value="">Sin asignar</option>
              {brands.filter((item) => item.status === 'ACTIVE').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            <span>Categoría canónica</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={!canCreate || submitting}>
              <option value="">Sin asignar</option>
              {eligibleCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label><span>Precio de venta (COP) *</span><input type="number" min="0" step="1" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} required disabled={!canCreate || submitting} /></label>
          <label>
            <span>Estado inicial</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as ProductStatus)} disabled={!canCreate || submitting}>
              {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        </div>
        <p className="form-help">La opción recomendada para un alta todavía incompleta es INACTIVO. El lifecycle no sustituye la readiness de publicación.</p>
        {error ? <div className="error-state" role="alert">{error}</div> : null}
        <div className="form-actions">
          <Link className="button-link button-link--secondary" to="/products">Cancelar</Link>
          <button type="submit" disabled={!canCreate || submitting}>{submitting ? 'Creando…' : 'Crear Product Master'}</button>
        </div>
      </form>
    </section>
  );
}
