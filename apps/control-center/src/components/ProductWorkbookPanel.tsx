import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProductListItemDTO } from '@lihen/products';
import {
  previewProductWorkbook,
  type ProductWorkbookPreview,
  type WorkbookRow,
} from '../lib/product-workbook';
import { useUnsavedChanges } from '../drafts/UnsavedChanges';

export function ProductWorkbookPanel({
  products,
  onReadInventory,
}: {
  products: readonly ProductListItemDTO[];
  onReadInventory: () => Promise<
    readonly {
      productId: string;
      stockOnHand: number;
      stockReserved: number;
      stockPending: number;
      stockAvailable: number;
    }[]
  >;
}) {
  const [preview, setPreview] = useState<ProductWorkbookPreview[]>([]);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [inventory, setInventory] = useState<Awaited<ReturnType<typeof onReadInventory>> | null>(
    null,
  );
  const [reviewed, setReviewed] = useState(false);
  const [channelFilter, setChannelFilter] = useState('all');
  useUnsavedChanges(preview.length > 0);
  function download(bytes: BlobPart, filename: string, type: string) {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error && /^XLSX_[A-Z_]+$/.test(error.message)
          ? error.message
          : 'XLSX_OPERATION_FAILED',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card stack">
      <h2>Excel · revisión masiva local</h2>
      <p>
        Dos pilotos; los demás productos, imágenes e historial permanecen intactos. Importar crea
        una vista previa, nunca escribe en DEV. Nombre e ID vigentes se verifican contra la lectura
        actual.
      </p>
      <button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const module = await import('../lib/product-workbook');
            const bytes = await module.exportProductWorkbook(module.productWorkbookRows(products));
            download(
              new Uint8Array(bytes).buffer,
              'lihen-pilotos.xlsx',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            );
          })
        }
      >
        Exportar pilotos .xlsx / plantilla
      </button>
      <label>
        Importar .xlsx para vista previa
        <input
          type="file"
          accept=".xlsx"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setPreview([]);
            setReviewed(false);
            setInventory(null);
            void run(async () => {
              if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 5 * 1024 * 1024)
                throw new Error('XLSX_FILE_LIMIT');
              const module = await import('../lib/product-workbook');
              setPreview(
                module.previewProductWorkbook(
                  await module.readProductWorkbook(new Uint8Array(await file.arrayBuffer())),
                  products,
                ),
              );
            });
          }}
        />
      </label>
      {preview.length > 0 && (
        <>
          <p>
            {preview.length} filas; {preview.filter((row) => row.errors.length).length} con errores.
            Selección independiente, candidata; no es activación comercial.
          </p>
          <label>
            Filtrar selección candidata
            <select
              aria-label="Filtrar selección candidata"
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value)}
            >
              <option value="all">Todos</option>
              <option value="catalogBeauty">Catálogo Beauty Care</option>
              <option value="catalogStyle">Catálogo Style</option>
              <option value="web">Tienda web</option>
            </select>
          </label>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Nombre candidato</th>
                  <th>Beauty</th>
                  <th>Style</th>
                  <th>Web</th>
                  <th>Validación</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, index) => (
                  <tr
                    key={index}
                    hidden={
                      channelFilter !== 'all' &&
                      row.values[channelFilter as keyof WorkbookRow] !== 'true'
                    }
                  >
                    <td>
                      <span>
                        {row.values.sku} · {row.values.currentName}
                      </span>
                      {row.errors.length === 0 && (
                        <p>
                          <Link
                            to={`/content/social?product=${encodeURIComponent(row.values.productId)}`}
                          >
                            Preparar contenido candidato · sin publicar
                          </Link>
                        </p>
                      )}
                    </td>
                    <td>{row.values.candidateName || 'Sin cambio'}</td>
                    {(['catalogBeauty', 'catalogStyle', 'web'] as const).map((channel) => (
                      <td key={channel}>
                        <input
                          aria-label={`${row.values.sku} ${channel}`}
                          type="checkbox"
                          checked={row.values[channel] === 'true'}
                          disabled={
                            row.errors.length > 0 ||
                            (channel === 'catalogBeauty' &&
                              row.values.businessLine !== 'BEAUTY_CARE') ||
                            (channel === 'catalogStyle' && row.values.businessLine !== 'STYLE')
                          }
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setReviewed(false);
                            setPreview((current) =>
                              previewProductWorkbook(
                                current.map((item, i): WorkbookRow =>
                                  i === index
                                    ? { ...item.values, [channel]: String(checked) }
                                    : item.values,
                                ),
                                products,
                              ),
                            );
                          }}
                        />
                      </td>
                    ))}
                    <td>
                      {[...row.errors, ...row.pending].join(' · ') ||
                        'CANDIDATE · revisión pendiente'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setInventory(null);
                const rows = await onReadInventory();
                setInventory(rows);
                setMessage('Inventario leído; no se registró ningún movimiento.');
              })
            }
          >
            Consultar inventario existente antes de operación masiva
          </button>
          <p>
            Inventario:{' '}
            {inventory === null
              ? 'NO VERIFICADO'
              : 'lectura disponible; sin conciliación comercial automática'}
            .
          </p>
          <label>
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
            />
            Revisé la vista previa; exportar no aprueba cambios comerciales.
          </label>
          <button
            disabled={!reviewed || preview.some((row) => row.errors.length > 0)}
            onClick={() =>
              download(
                JSON.stringify(
                  {
                    stage: 'CANDIDATE',
                    humanApprovalRequired: true,
                    commercialWritesAuthorized: false,
                    publicationAuthorized: false,
                    inventoryObserved: inventory !== null,
                    products: preview.map((row) => ({
                      ...row,
                      inventory:
                        inventory?.filter(
                          (balance) => balance.productId === row.values.productId,
                        ) ?? null,
                    })),
                  },
                  null,
                  2,
                ),
                'lihen-pilotos-plan-candidato.json',
                'application/json',
              )
            }
          >
            Exportar plan candidato para revisión
          </button>
          <button disabled>Aplicar cambios comerciales · autorización específica pendiente</button>
        </>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
