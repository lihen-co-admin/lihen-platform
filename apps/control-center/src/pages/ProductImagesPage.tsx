import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  createAddProductImageCommand,
  createGetProductImagesQuery,
  createSetMainProductImageCommand,
  type ProductDetailDTO,
  type ProductImageDTO,
  createGetProductByIdQuery,
} from '@lihen/products';
import { PageHeader } from '../components/PageHeader';
import { productsComposition } from '../composition/products';

export function ProductImagesPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<ProductDetailDTO | null>(null);
  const [images, setImages] = useState<readonly ProductImageDTO[]>([]);
  const [publicUrl, setPublicUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [makeMain, setMakeMain] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh(productId: string): Promise<void> {
    const [detail, productImages] = await Promise.all([
      productsComposition.getProductById.execute(createGetProductByIdQuery(productId)),
      productsComposition.canReadImages
        ? productsComposition.getProductImages.execute(createGetProductImagesQuery(productId))
        : Promise.resolve([]),
    ]);
    setProduct(detail);
    setImages(productImages);
  }

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    refresh(id)
      .catch(() => setError('No fue posible cargar las imágenes del producto.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!id || !productsComposition.canManageImages) return;
    setError(null);
    try {
      await productsComposition.addProductImage.execute(
        createAddProductImageCommand({
          productId: id,
          publicUrl,
          ...(altText.trim() ? { altText } : {}),
          makeMain,
        }),
      );
      setPublicUrl('');
      setAltText('');
      setMakeMain(false);
      await refresh(id);
    } catch {
      setError('No fue posible agregar la imagen. Verifica la URL y vuelve a intentarlo.');
    }
  }

  async function handleSetMain(imageId: string): Promise<void> {
    if (!id || !productsComposition.canManageImages) return;
    setError(null);
    try {
      const updated = await productsComposition.setMainProductImage.execute(
        createSetMainProductImageCommand(id, imageId),
      );
      setImages(updated);
    } catch {
      setError('No fue posible establecer la imagen principal.');
    }
  }

  return (
    <section>
      <PageHeader
        title="Imágenes del producto"
        description="FASE 1.7: ProductImage + AddProductImage + SetMainProductImage. Supabase Storage continúa bloqueado."
      />

      <div className="detail-actions">
        <Link to={id ? `/products/${id}` : '/products'}>← Volver al producto</Link>
      </div>

      {loading ? <div className="empty-state">Cargando imágenes…</div> : null}
      {error ? <div className="error-state" role="alert">{error}</div> : null}

      {!loading && !product ? (
        <div className="empty-state">Producto no encontrado.</div>
      ) : null}

      {!loading && product ? (
        <>
          <div className="detail-card">
            <h2>{product.name}</h2>
            {!productsComposition.canManageImages ? (
              <p className="muted-text">
                La escritura de imágenes y Supabase Storage están bloqueadas hasta aprobar schema, RLS y policies de Storage en DEV.
              </p>
            ) : (
              <form className="form-stack" onSubmit={handleAdd}>
                <label>
                  URL pública de imagen *
                  <input
                    aria-label="URL pública de imagen *"
                    type="url"
                    required
                    value={publicUrl}
                    onChange={(event) => setPublicUrl(event.target.value)}
                  />
                </label>
                <label>
                  Texto alternativo
                  <input
                    aria-label="Texto alternativo"
                    value={altText}
                    onChange={(event) => setAltText(event.target.value)}
                  />
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={makeMain}
                    onChange={(event) => setMakeMain(event.target.checked)}
                  />
                  Convertir en imagen principal
                </label>
                <button type="submit">Agregar imagen</button>
              </form>
            )}
          </div>

          <section className="detail-card" aria-labelledby="product-images-title">
            <h2 id="product-images-title">Galería</h2>
            {!productsComposition.canReadImages ? (
              <p className="muted-text">La lectura persistente de product_images se habilitará después del precheck DEV.</p>
            ) : images.length === 0 ? (
              <p className="muted-text">Este producto todavía no tiene imágenes en el repositorio en memoria.</p>
            ) : (
              <div className="image-grid">
                {images.map((image) => (
                  <article className="image-card" key={image.id}>
                    <img src={image.publicUrl} alt={image.altText ?? product.name} />
                    <div>
                      <strong>{image.isMain ? 'Principal' : `Orden ${image.sortOrder}`}</strong>
                      <p className="muted-text">{image.altText ?? 'Sin texto alternativo'}</p>
                      {!image.isMain && productsComposition.canManageImages ? (
                        <button type="button" onClick={() => void handleSetMain(image.id)}>
                          Hacer principal
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
