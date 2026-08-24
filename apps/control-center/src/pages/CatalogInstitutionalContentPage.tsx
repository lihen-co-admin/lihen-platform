import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import {
  catalogInstitutionalComposition,
  type CatalogInstitutionalContent,
  type InstitutionalPaymentMethod,
} from '../composition/catalog-institutional';


const EMPTY_CONTENT: CatalogInstitutionalContent = {
  aboutTitle: '',
  aboutBody: '',
  aboutImageUrl: '',
  purchaseTitle: '',
  purchaseIntro: '',
  purchaseSections: [],
  legalName: '',
  taxId: '',
  locationText: '',
  paymentTitle: '',
  paymentMethods: [],
  connectTitle: '',
  connectMessage: '',
  channels: {
    storefrontUrl: '',
    whatsappUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
    facebookUrl: '',
    whatsappCommunityUrl: '',
  },
  footerLabel: '',
  updatedAt: null,
};

function QrPreview({ value }: { value: string }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let active = true;
    setSrc('');
    if (!value.trim()) return () => { active = false; };

    catalogInstitutionalComposition
      .generateQrSvg(value)
      .then((svg) => {
        if (active) {
          setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        }
      })
      .catch(() => {
        if (active) setSrc('');
      });

    return () => {
      active = false;
    };
  }, [value]);

  return src ? <img className="institutional-qr-preview" src={src} alt="Vista previa QR" /> : null;
}

export function CatalogInstitutionalContentPage() {
  const [content, setContent] = useState<CatalogInstitutionalContent>(EMPTY_CONTENT);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [paymentQrUploadingIndex, setPaymentQrUploadingIndex] = useState<number | null>(null);

  useEffect(() => {
    catalogInstitutionalComposition
      .getCurrent()
      .then(setContent)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'No fue posible cargar la configuración.'),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="stack">
        <PageHeader title="Contenido institucional" description="Configuración editable del catálogo." />
        {error ? <div className="error-state">{error}</div> : <div className="info-state">Cargando...</div>}
      </section>
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await catalogInstitutionalComposition.save(content);
      setMessage('Contenido institucional guardado. Las versiones ACTIVE existentes no cambian.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible guardar.');
    }
  }

  async function uploadAboutImage(file?: File) {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await catalogInstitutionalComposition.uploadAsset(file, 'about');
      setContent((current) => ({ ...current, aboutImageUrl: url }));
      setMessage('Imagen subida. Guarda la configuración para conservarla.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible subir la imagen.');
    } finally {
      setUploading(false);
    }
  }

  async function uploadPaymentQr(index: number, file?: File) {
    if (!file) return;
    setPaymentQrUploadingIndex(index);
    setError('');
    setMessage('');
    try {
      const url = await catalogInstitutionalComposition.uploadAsset(
        file,
        `payment-qr-${index + 1}`,
      );
      updatePayment(index, {
        qrSourceType: 'IMAGE',
        qrValue: url,
        qrFileName: file.name,
        qrMimeType: file.type,
      });
      setMessage('QR bancario subido. Guarda la configuración para conservarlo.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible subir el QR.');
    } finally {
      setPaymentQrUploadingIndex(null);
    }
  }

  function updatePayment(index: number, patch: Partial<InstitutionalPaymentMethod>) {
    setContent((current) => {
      const next = [...current.paymentMethods];
      const existing = next[index];
      if (!existing) return current;
      next[index] = { ...existing, ...patch };
      return { ...current, paymentMethods: next };
    });
  }

  function addPayment() {
    setContent((current) => {
      const next: InstitutionalPaymentMethod = {
        id: crypto.randomUUID(),
        label: 'Nuevo medio',
        identifier: '',
        qrSourceType: 'URL',
        qrValue: '',
        qrFileName: '',
        qrMimeType: '',
        enabled: true,
        sortOrder: current.paymentMethods.length,
      };
      return { ...current, paymentMethods: [...current.paymentMethods, next] };
    });
  }

  function removePayment(index: number) {
    setContent((current) => ({
      ...current,
      paymentMethods: current.paymentMethods.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  return (
    <section className="stack">
      <div className="page-heading-row">
        <PageHeader
          title="Contenido institucional"
          description="Edita textos, foto, canales y medios de pago. Los QR se generan desde los links/payloads y cada DRAFT captura su propio snapshot."
        />
        <Link className="button-link button-link--secondary" to="/catalogs">Volver a Catálogos</Link>
      </div>

      {message ? <div className="info-state" role="status">{message}</div> : null}
      {error ? <div className="error-state" role="alert">{error}</div> : null}

      <form className="stack" onSubmit={save}>
        <section className="card stack">
          <h2>Página 2 · ¿Quiénes somos?</h2>
          <label className="institutional-field">
            <span>Título</span>
            <input value={content.aboutTitle} onChange={(e) => setContent({ ...content, aboutTitle: e.target.value })} />
          </label>
          <label className="institutional-field">
            <span>Texto institucional</span>
            <textarea rows={6} value={content.aboutBody} onChange={(e) => setContent({ ...content, aboutBody: e.target.value })} />
          </label>
          <label className="institutional-field">
            <span>Fotografía principal</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(e) => void uploadAboutImage(e.target.files?.[0])} />
          </label>
          {content.aboutImageUrl ? <img className="institutional-photo-preview" src={content.aboutImageUrl} alt="Foto institucional actual" /> : <p className="muted-text">Sin fotografía configurada.</p>}
        </section>

        <section className="card stack">
          <h2>Página 3 · Información importante de compra</h2>
          <label className="institutional-field">
            <span>Título</span>
            <input value={content.purchaseTitle} onChange={(e) => setContent({ ...content, purchaseTitle: e.target.value })} />
          </label>
          <label className="institutional-field">
            <span>Introducción</span>
            <textarea rows={3} value={content.purchaseIntro} onChange={(e) => setContent({ ...content, purchaseIntro: e.target.value })} />
          </label>
          {content.purchaseSections.map((section, index) => (
            <div className="institutional-subcard" key={section.key}>
              <input
                value={section.label}
                onChange={(e) => {
                  const next = [...content.purchaseSections];
                  next[index] = { ...section, label: e.target.value };
                  setContent({ ...content, purchaseSections: next });
                }}
              />
              <textarea
                rows={3}
                value={section.body}
                onChange={(e) => {
                  const next = [...content.purchaseSections];
                  next[index] = { ...section, body: e.target.value };
                  setContent({ ...content, purchaseSections: next });
                }}
              />
            </div>
          ))}
          <div className="form-grid">
            <label><span>Razón social</span><input value={content.legalName} onChange={(e) => setContent({ ...content, legalName: e.target.value })} /></label>
            <label><span>NIT</span><input value={content.taxId} onChange={(e) => setContent({ ...content, taxId: e.target.value })} /></label>
            <label><span>Ubicación</span><input value={content.locationText} onChange={(e) => setContent({ ...content, locationText: e.target.value })} /></label>
            <label><span>Cierre</span><input value={content.footerLabel} onChange={(e) => setContent({ ...content, footerLabel: e.target.value })} /></label>
          </div>
        </section>

        <section className="card stack">
          <div className="toolbar">
            <h2>Página 4 · Medios de pago</h2>
            <button type="button" onClick={addPayment}>Agregar medio</button>
          </div>
          <label className="institutional-field">
            <span>Título</span>
            <input value={content.paymentTitle} onChange={(e) => setContent({ ...content, paymentTitle: e.target.value })} />
          </label>
          {content.paymentMethods.length === 0 ? <p className="muted-text">Aún no hay medios configurados. No se inventan datos bancarios.</p> : null}
          {content.paymentMethods.map((method, index) => (
            <div className="institutional-payment-grid" key={method.id}>
              <label><span>Nombre</span><input value={method.label} onChange={(e) => updatePayment(index, { label: e.target.value })} /></label>
              <label><span>Identificador visible</span><input value={method.identifier} onChange={(e) => updatePayment(index, { identifier: e.target.value })} /></label>
              <label>
                <span>Tipo QR</span>
                <select
                  value={method.qrSourceType}
                  onChange={(e) => {
                    const qrSourceType = e.target.value as InstitutionalPaymentMethod['qrSourceType'];
                    updatePayment(index, {
                      qrSourceType,
                      qrValue: '',
                      qrFileName: '',
                      qrMimeType: '',
                    });
                  }}
                >
                  <option value="URL">URL</option>
                  <option value="PAYLOAD">Payload</option>
                  <option value="IMAGE">Imagen QR existente</option>
                </select>
              </label>

              {method.qrSourceType === 'IMAGE' ? (
                <div className="institutional-field institutional-field--wide">
                  <span>Archivo QR oficial</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={paymentQrUploadingIndex === index}
                    onChange={(e) => void uploadPaymentQr(index, e.target.files?.[0])}
                  />
                  {method.qrFileName ? (
                    <small className="muted-text">{method.qrFileName}</small>
                  ) : (
                    <small className="muted-text">Sube la imagen QR entregada por el banco o billetera.</small>
                  )}
                  {method.qrValue ? (
                    <div className="institutional-payment-qr-actions">
                      <img className="institutional-qr-preview" src={method.qrValue} alt={`QR ${method.label}`} />
                      <button
                        type="button"
                        className="button-link button-link--secondary"
                        onClick={() => updatePayment(index, { qrValue: '', qrFileName: '', qrMimeType: '' })}
                      >
                        Quitar QR
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <label className="institutional-field--wide">
                  <span>{method.qrSourceType === 'PAYLOAD' ? 'Payload QR' : 'URL para generar QR'}</span>
                  <input
                    value={method.qrValue}
                    onChange={(e) => updatePayment(index, { qrValue: e.target.value })}
                    placeholder={method.qrSourceType === 'PAYLOAD' ? 'Pega el payload exacto' : 'https://...'}
                  />
                </label>
              )}

              <label className="checkbox-row"><input type="checkbox" checked={method.enabled} onChange={(e) => updatePayment(index, { enabled: e.target.checked })} /> Mostrar</label>
              {method.enabled && method.qrValue && method.qrSourceType !== 'IMAGE' ? <QrPreview value={method.qrValue} /> : null}
              <button type="button" onClick={() => removePayment(index)}>Eliminar medio</button>
            </div>
          ))}
        </section>

        <section className="card stack">
          <h2>Página final · Conecta con LIHEN</h2>
          <label className="institutional-field"><span>Título</span><input value={content.connectTitle} onChange={(e) => setContent({ ...content, connectTitle: e.target.value })} /></label>
          <label className="institutional-field"><span>Mensaje</span><textarea rows={4} value={content.connectMessage} onChange={(e) => setContent({ ...content, connectMessage: e.target.value })} /></label>
          {([
            ['storefrontUrl', 'Tienda virtual'],
            ['whatsappUrl', 'Comprar / consultar'],
            ['instagramUrl', 'Instagram'],
            ['tiktokUrl', 'TikTok'],
            ['facebookUrl', 'Facebook'],
            ['whatsappCommunityUrl', 'Comunidad WhatsApp'],
          ] as const).map(([key, label]) => (
            <div className="institutional-channel-row" key={key}>
              <label><span>{label}</span><input type="url" placeholder="https://..." value={content.channels[key]} onChange={(e) => setContent({ ...content, channels: { ...content.channels, [key]: e.target.value } })} /></label>
              {content.channels[key] ? <QrPreview value={content.channels[key]} /> : <span className="muted-text">Sin link</span>}
            </div>
          ))}
        </section>

        <div className="form-actions">
          <button type="submit">Guardar contenido institucional</button>
        </div>
      </form>
    </section>
  );
}
