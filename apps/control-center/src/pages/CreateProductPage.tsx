import { type FormEvent, useEffect, useState } from 'react';
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
  type BrandDTO,
  type BusinessLine,
  type CategoryDTO,
  type ProductStatus,
} from '@lihen/products';
import { useAuth } from '../auth/auth-context';
import { PageHeader } from '../components/PageHeader';
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!canCreate) {
      setError('CreateProduct controlado no está habilitado para esta sesión.');
      return;
    }

    const numericPrice = Number(salePrice);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      setError('Ingresa un precio válido mayor o igual a 0.');
      return;
    }

    if (businessLine === 'STYLE' && categories.filter((item) => item.businessLine === 'STYLE').length === 0) {
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
          operationKey: `phase2.2:create-product:${commandId}`,
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
      else if (caught instanceof ProductWriteBlockedError) setError('El RPC CreateProduct controlado permanece bloqueado en este entorno.');
      else setError('No fue posible crear el producto. Revisa los datos e inténtalo nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <PageHeader
        title="Crear producto"
        description="FASE 2.2: creación controlada en Supabase DEV mediante RPC, con perfil ACTIVE y rol OWNER/ADMIN."
      />
      <p><Link to="/products">← Volver a productos</Link></p>
      {!canCreate ? (
        <div className="warning-state">
          <strong>Creación controlada no disponible.</strong>
          <p>La sesión debe estar autorizada y VITE_PRODUCT_WRITE_MODE debe estar en controlled.</p>
        </div>
      ) : null}
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
              {categories.filter((item) => item.status === 'ACTIVE' && item.businessLine === businessLine).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
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
        <p className="form-help">Por seguridad, el formulario inicia en INACTIVO. Crear el registro no lo publica en la tienda ni asigna inventario o imagen automáticamente.</p>
        {error ? <div className="error-state" role="alert">{error}</div> : null}
        <div className="form-actions">
          <Link className="button-link button-link--secondary" to="/products">Cancelar</Link>
          <button type="submit" disabled={!canCreate || submitting}>{submitting ? 'Creando…' : 'Crear producto'}</button>
        </div>
      </form>
    </section>
  );
}
