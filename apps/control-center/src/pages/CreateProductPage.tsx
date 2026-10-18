import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BrandNotFoundError,
  CategoryNotFoundError,
  createCreateProductCommand,
  createGetProductByIdQuery,
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
import { useDraftEntities, useLocalFormDraft } from '../drafts/FormDraftProvider';
import { FormDraftNotice } from '../drafts/FormDraftNotice';
import {
  emptyProductCreateDraft,
  productCreateDraftCodec,
  normalizeProductCreateDraft,
  createDraftTaxonomyError,
  provisionalProductIdPattern,
  type ProductCreateDraft,
} from '../drafts/product-create-draft';
import {
  controlledDraftCreateCommand,
  fixedIdentityCreateHandler,
  confirmCreatedDraft,
} from '../composition/product-create-draft';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const identities = useDraftEntities('products', 'create-identity');
  const candidateId = searchParams.get('draft') ?? '';
  const provisionalId = provisionalProductIdPattern.test(candidateId) ? candidateId : null;
  const { session: draftSession, snapshot: draftSnapshot } = useLocalFormDraft(
    identities.enabled && provisionalId
      ? { module: 'products', entity: 'new:' + provisionalId, form: 'create-identity' }
      : null,
    productCreateDraftCodec,
    emptyProductCreateDraft,
  );
  const [fallbackValues, setFallbackValues] = useState<ProductCreateDraft>(emptyProductCreateDraft);
  const values = draftSnapshot?.value ?? fallbackValues;
  const { sku, catalogCode, name, businessLine, brandId, categoryId, status } = values;
  const busyRef = useRef(false);
  const mounted = useRef(false);
  const viewIdentity = useRef(provisionalId);
  viewIdentity.current = provisionalId;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (identities.enabled && !provisionalId) {
      const next = new URLSearchParams(searchParams);
      const existing = identities.entities
        .filter(
          (entity) =>
            entity.startsWith('new:') && provisionalProductIdPattern.test(entity.slice(4)),
        )
        .sort()[0];
      next.set('draft', existing ? existing.slice(4) : crypto.randomUUID());
      setSearchParams(next, { replace: true });
    }
  }, [identities.enabled, provisionalId, searchParams, setSearchParams]);
  function edit(patch: Partial<ProductCreateDraft>) {
    const next = { ...values, ...patch };
    try {
      if (draftSession) draftSession.edit(next);
      else setFallbackValues(next);
    } catch {
      setError('No se pudo conservar el borrador. Mantén esta pantalla abierta.');
    }
  }
  const [brands, setBrands] = useState<readonly BrandDTO[]>([]);
  const [categories, setCategories] = useState<readonly CategoryDTO[]>([]);
  const [salePrice, setSalePrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxonomyReady, setTaxonomyReady] = useState(false);
  const taxonomyError = createDraftTaxonomyError(values, brands, categories);
  const fieldsLocked =
    submitting ||
    Boolean(draftSnapshot?.pending || draftSnapshot?.operation || draftSnapshot?.storageError) ||
    (identities.enabled && (!provisionalId || identities.storageError));
  useEffect(() => {
    setSalePrice('');
  }, [provisionalId]);
  const canCreate = productsComposition.canCreate && auth.authorized;

  useEffect(() => {
    let active = true;
    Promise.all([
      productsComposition.getBrands.execute(createGetBrandsQuery()),
      productsComposition.getCategories.execute(createGetCategoriesQuery()),
    ])
      .then(([loadedBrands, loadedCategories]) => {
        if (!active) return;
        setTaxonomyReady(true);
        setBrands(loadedBrands);
        setCategories(loadedCategories);
      })
      .catch(() => {
        if (active) setError('No fue posible cargar la taxonom\u00eda can\u00f3nica.');
      });
    return () => {
      active = false;
    };
  }, []);

  const eligibleCategories = useMemo(
    () =>
      categories.filter((item) => item.status === 'ACTIVE' && item.businessLine === businessLine),
    [businessLine, categories],
  );

  const selectedBrand = useMemo(
    () => brands.find((item) => item.id === brandId),
    [brandId, brands],
  );
  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === categoryId),
    [categories, categoryId],
  );
  const masterReadiness = useMemo(
    () =>
      evaluateProductMasterReadiness({
        businessLine,
        ...(brandId ? { brandId } : {}),
        ...(selectedBrand ? { brandStatus: selectedBrand.status } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(selectedCategory
          ? {
              categoryStatus: selectedCategory.status,
              categoryBusinessLine: selectedCategory.businessLine,
            }
          : {}),
        status,
      }),
    [brandId, businessLine, categoryId, selectedBrand, selectedCategory, status],
  );

  const insights = useMemo<readonly IntelligenceInsight[]>(() => {
    const items: IntelligenceInsight[] = [];
    if (masterReadiness.issues.includes('BRAND_REQUIRED'))
      items.push({
        id: 'brand',
        severity: 'INFO',
        title: 'Marca todavía sin asignar',
        explanation:
          'Puede crearse sin marca, pero la identidad canónica seguirá incompleta hasta asociar una marca existente.',
        source: 'Product Master readiness',
      });
    if (masterReadiness.issues.includes('CATEGORY_REQUIRED'))
      items.push({
        id: 'category',
        severity: 'INFO',
        title: 'Categoría todavía sin asignar',
        explanation:
          'LIHEN no inventará categorías. Selecciona únicamente una categoría canónica compatible con la línea de negocio.',
        source: 'Product Master readiness',
      });
    if (businessLine === 'STYLE' && eligibleCategories.length === 0)
      items.push({
        id: 'style-taxonomy',
        severity: 'WARNING',
        title: 'STYLE sin categoría elegible',
        explanation:
          'No debe crearse una categoría improvisada para completar el alta. Primero debe existir taxonomía canónica válida.',
        source: 'Categorías',
      });
    if (status === 'ACTIVE')
      items.push({
        id: 'active-start',
        severity: 'WARNING',
        title: 'Inicio en estado Activo',
        explanation:
          'Crear un producto activo no lo publica automáticamente, pero aumenta el riesgo de asumir readiness antes de completar media y taxonomía.',
        source: 'Lifecycle',
      });
    if (items.length === 0)
      items.push({
        id: 'safe-draft',
        severity: 'SUCCESS',
        title: 'Alta preparada de forma conservadora',
        explanation:
          'El producto se creará con identidad canónica y lifecycle controlado. Inventario, imágenes y publicación siguen siendo responsabilidades separadas.',
        source: 'Product Master',
      });
    return items;
  }, [businessLine, eligibleCategories.length, masterReadiness, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busyRef.current ||
      draftSnapshot?.pending ||
      draftSnapshot?.operation ||
      draftSnapshot?.storageError ||
      (identities.enabled && !draftSession)
    )
      return;
    setError(null);

    if (!canCreate) {
      setError('La creación controlada no está habilitada para esta sesión.');
      return;
    }

    const numericPrice = Number(salePrice);
    if (!salePrice.trim() || !Number.isFinite(numericPrice) || numericPrice < 0) {
      setError('Ingresa un precio válido mayor o igual a 0.');
      return;
    }

    if (businessLine === 'STYLE' && eligibleCategories.length === 0) {
      setError(
        'STYLE todavía no tiene taxonomía canónica disponible. No se creará una categoría inventada.',
      );
      return;
    }

    if (!taxonomyReady || taxonomyError) {
      setError(taxonomyError ?? 'Espera la lectura de taxonom\u00eda can\u00f3nica.');
      return;
    }
    busyRef.current = true;
    setSubmitting(true);
    let dispatched = false;
    try {
      if (draftSession && provisionalId && auth.user?.id) {
        const normalized = normalizeProductCreateDraft(values);
        const [freshBrands, freshCategories] = await Promise.all([
          productsComposition.getBrands.execute(createGetBrandsQuery()),
          productsComposition.getCategories.execute(createGetCategoriesQuery()),
        ]);
        if (mounted.current && viewIdentity.current === provisionalId) {
          setBrands(freshBrands);
          setCategories(freshCategories);
        }
        const freshTaxonomyError = createDraftTaxonomyError(
          normalized,
          freshBrands,
          freshCategories,
        );
        if (freshTaxonomyError) throw new Error(freshTaxonomyError);
        controlledDraftCreateCommand(
          { key: provisionalId, requestedAt: new Date().toISOString(), phase: 'IN_FLIGHT' },
          auth.user.id,
          normalized,
          numericPrice,
        );
        const existing = await productsComposition.getProductById.execute(
          createGetProductByIdQuery(provisionalId),
        );
        if (existing)
          throw new Error(
            'La identidad provisional ya existe. Consulta el producto; no se enviará otra creación.',
          );
        draftSession.edit(normalized);
        const operation = draftSession.beginSave();
        const command = controlledDraftCreateCommand(
          operation,
          auth.user.id,
          normalized,
          numericPrice,
        );
        dispatched = true;
        const result = await fixedIdentityCreateHandler(productsComposition, provisionalId).execute(
          command,
        );
        if (
          result.id !== provisionalId ||
          !(await confirmCreatedDraft(
            productsComposition,
            draftSession,
            provisionalId,
            numericPrice,
          ))
        )
          throw new Error('No se confirmó la creación por lectura.');
        if (mounted.current && viewIdentity.current === provisionalId)
          navigate(`/products/${result.id}`);
        return;
      }
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
      if (mounted.current) navigate(`/products/${result.id}`);
    } catch (caught) {
      if (dispatched) draftSession?.markUncertain();
      else draftSession?.rejectBeforeWrite();
      if (!mounted.current || viewIdentity.current !== provisionalId) return;
      if (caught instanceof DuplicateProductSkuError)
        setError('Ya existe un producto con ese SKU.');
      else if (caught instanceof DuplicateCatalogCodeError)
        setError('Ya existe un producto con ese código de catálogo.');
      else if (caught instanceof BrandNotFoundError)
        setError('La marca seleccionada ya no existe.');
      else if (caught instanceof CategoryNotFoundError)
        setError('La categoría seleccionada ya no existe.');
      else if (caught instanceof ProductCreateForbiddenError)
        setError('Tu perfil no tiene autorización OWNER/ADMIN para crear productos.');
      else if (caught instanceof ProductWriteBlockedError)
        setError('La creación controlada permanece bloqueada en este entorno.');
      else
        setError(
          caught instanceof Error
            ? caught.message
            : 'No se confirm\u00f3 la creaci\u00f3n. El reenv\u00edo permanece bloqueado.',
        );
    } finally {
      busyRef.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  async function verifyCreation() {
    if (
      !draftSession ||
      !provisionalId ||
      busyRef.current ||
      draftSnapshot?.pending ||
      !salePrice.trim()
    )
      return;
    busyRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      if (
        !(await confirmCreatedDraft(
          productsComposition,
          draftSession,
          provisionalId,
          Number(salePrice),
        ))
      )
        throw new Error(
          'No se verificó el producto con esa identidad, contenido y precio. El borrador sigue pendiente; no se reenviará la creación.',
        );
      if (mounted.current && viewIdentity.current === provisionalId)
        navigate(`/products/${provisionalId}`);
    } catch (cause) {
      if (mounted.current && viewIdentity.current === provisionalId)
        setError(cause instanceof Error ? cause.message : 'No se pudo verificar la creación.');
    } finally {
      busyRef.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <AdminPageHero
        eyebrow="PRODUCT MASTER"
        title="Nuevo producto"
        description="Crea la identidad canónica del producto. Inventario, media, publicación y cambios posteriores de precio permanecen separados y trazables."
        accent="lilac"
        actions={
          <Link className="button-link button-link--secondary" to="/products">
            ← Productos
          </Link>
        }
        status={<span className="status-badge">CONTROLLED WRITE</span>}
      />

      <FormDraftNotice
        session={draftSession}
        snapshot={draftSnapshot}
        cleanHelp="Formulario nuevo: todavía no hay un producto guardado en Supabase."
        uncertainHelp="Reenvío de creación bloqueado. Introduce el precio esperado y verifica por lectura el ID provisional; no se enviará otra escritura."
      />
      {identities.enabled ? (
        <aside className="info-state" aria-label="Recuperación de creaciones">
          <p>
            El precio de venta no se conserva localmente. Tras navegar o recargar, introdúcelo
            nuevamente. Para una operación pendiente se usa solo para verificar, sin reenviar.
          </p>
          {provisionalId ? <p>Identidad provisional: {provisionalId}</p> : null}
          <button
            type="button"
            disabled={Boolean(draftSnapshot?.operation) || submitting || identities.storageError}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('draft', crypto.randomUUID());
              setSearchParams(next);
            }}
          >
            Iniciar otra creación
          </button>
          {identities.storageError ? (
            <p role="alert">
              No se pudo consultar el almacenamiento de borradores; la creación permanece bloqueada.
            </p>
          ) : null}
          {identities.entities
            .filter(
              (entity) =>
                entity.startsWith('new:') &&
                provisionalProductIdPattern.test(entity.slice(4)) &&
                entity !== 'new:' + provisionalId,
            )
            .map((entity) => (
              <p key={entity}>
                <Link to={`/products/new?draft=${entity.slice(4)}`}>
                  Recuperar creación {entity.slice(4)}
                </Link>
              </p>
            ))}
        </aside>
      ) : null}
      {taxonomyError ? <p role="alert">{taxonomyError}</p> : null}
      {!canCreate ? (
        <OperationalNotice
          title="Creación protegida"
          tone="warning"
          meta="Auth + OWNER/ADMIN + feature flag"
        >
          <p>
            La UI puede preparar el formulario, pero la escritura solo se habilita cuando la sesión
            y la configuración cumplen el contrato controlado.
          </p>
        </OperationalNotice>
      ) : (
        <OperationalNotice title="Separación de responsabilidades" tone="success">
          <p>
            Crear el Product Master no publica el producto, no asigna inventario y no agrega
            imágenes automáticamente.
          </p>
        </OperationalNotice>
      )}

      <SummaryStrip
        items={[
          { label: 'Línea', value: businessLine === 'BEAUTY_CARE' ? 'Beauty Care' : 'Style' },
          { label: 'Identidad', value: masterReadiness.identityStatus },
          { label: 'Lifecycle', value: masterReadiness.lifecycleStatus },
          {
            label: 'Taxonomía',
            value: `${masterReadiness.issues.length} pendiente${masterReadiness.issues.length === 1 ? '' : 's'}`,
          },
        ]}
      />

      <IntelligencePanel
        insights={insights}
        description="Evalúa consistencia del Product Master. No sustituye media, precio, snapshot ni gates de publicación."
      />

      <form className="product-form" onSubmit={handleSubmit}>
        <p>Imágenes con LIHEN Intelligence y carga propia: disponibles desde la galería del producto después de confirmar su creación. No se asociarán archivos a un producto todavía no guardado.</p>
        <div className="form-grid">
          <label>
            <span>Nombre *</span>
            <input
              maxLength={500}
              value={name}
              onChange={(event) => edit({ name: event.target.value })}
              required
              disabled={!canCreate || fieldsLocked}
            />
          </label>
          <label>
            <span>Línea de negocio *</span>
            <select
              value={businessLine}
              onChange={(event) => {
                edit({ businessLine: event.target.value as BusinessLine, categoryId: '' });
              }}
              disabled={!canCreate || fieldsLocked}
            >
              <option value="BEAUTY_CARE">Beauty Care</option>
              <option value="STYLE">Style</option>
            </select>
          </label>
          <label>
            <span>SKU</span>
            <input
              maxLength={500}
              value={sku}
              onChange={(event) => edit({ sku: event.target.value })}
              disabled={!canCreate || fieldsLocked}
            />
          </label>
          <label>
            <span>Código catálogo</span>
            <input
              maxLength={500}
              value={catalogCode}
              onChange={(event) => edit({ catalogCode: event.target.value })}
              disabled={!canCreate || fieldsLocked}
            />
          </label>
          <label>
            <span>Marca canónica</span>
            <select
              value={brandId}
              onChange={(event) => edit({ brandId: event.target.value })}
              disabled={!canCreate || fieldsLocked}
            >
              <option value="">Sin asignar</option>
              {brands
                .filter((item) => item.status === 'ACTIVE')
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>Categoría canónica</span>
            <select
              value={categoryId}
              onChange={(event) => edit({ categoryId: event.target.value })}
              disabled={!canCreate || fieldsLocked}
            >
              <option value="">Sin asignar</option>
              {eligibleCategories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Precio de venta (COP) *</span>
            <input
              type="number"
              min="0"
              step="1"
              value={salePrice}
              onChange={(event) => setSalePrice(event.target.value)}
              required
              disabled={!canCreate || submitting || Boolean(draftSnapshot?.pending)}
            />
          </label>
          <label>
            <span>Estado inicial</span>
            <select
              value={status}
              onChange={(event) => edit({ status: event.target.value as ProductStatus })}
              disabled={!canCreate || fieldsLocked}
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="form-help">
          La opción recomendada para un alta todavía incompleta es INACTIVO. El lifecycle no
          sustituye la readiness de publicación.
        </p>
        {error ? (
          <div className="error-state" role="alert">
            {error}
          </div>
        ) : null}
        <div className="form-actions">
          {draftSnapshot?.operation ? (
            <button
              type="button"
              disabled={submitting || draftSnapshot.pending || !salePrice.trim()}
              onClick={() => void verifyCreation()}
            >
              Verificar creación pendiente
            </button>
          ) : null}
          <Link className="button-link button-link--secondary" to="/products">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={!canCreate || fieldsLocked || !taxonomyReady || Boolean(taxonomyError)}
          >
            {submitting ? 'Creando…' : 'Crear Product Master'}
          </button>
        </div>
      </form>
    </section>
  );
}
