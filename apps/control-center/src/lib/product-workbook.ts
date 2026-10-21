import type { ProductListItemDTO } from '@lihen/products';
import { identityBaseline } from '../domain/product-master-lab';
import { isPilotProduct } from '../domain/product-pilot-scope';

export const PRODUCT_WORKBOOK_HEADERS = [
  'productId',
  'sku',
  'currentName',
  'businessLine',
  'baseline',
  'currentStatus',
  'candidateName',
  'descriptionCandidate',
  'statusCandidate',
  'catalogBeauty',
  'catalogStyle',
  'web',
] as const;
export type WorkbookRow = Record<(typeof PRODUCT_WORKBOOK_HEADERS)[number], string>;
export interface ProductWorkbookPreview {
  row: number;
  values: WorkbookRow;
  errors: string[];
  pending: string[];
}
const statuses = ['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'ARCHIVED'];
export function productWorkbookRows(products: readonly ProductListItemDTO[]): WorkbookRow[] {
  return products.filter(isPilotProduct).map((product) => ({
    productId: product.id,
    sku: product.sku ?? '',
    currentName: product.name,
    businessLine: product.businessLine,
    baseline: identityBaseline(product),
    currentStatus: product.status,
    candidateName: '',
    descriptionCandidate: '',
    statusCandidate: '',
    catalogBeauty: 'false',
    catalogStyle: 'false',
    web: 'false',
  }));
}
export function previewProductWorkbook(
  rows: readonly WorkbookRow[],
  products: readonly ProductListItemDTO[],
): ProductWorkbookPreview[] {
  if (rows.length > 5000) throw new Error('XLSX_ROW_LIMIT');
  return rows.map((values, index) => {
    const errors: string[] = [],
      pending: string[] = [];
    const matches = products.filter((product) => product.id === values.productId);
    const product = matches.length === 1 ? matches[0] : undefined;
    if (!product || !isPilotProduct(product)) errors.push('PRODUCT_OUTSIDE_PILOT_OR_UNKNOWN');
    if (rows.filter((row) => row.productId === values.productId).length !== 1)
      errors.push('DUPLICATE_PRODUCT');
    if (
      product &&
      (values.sku !== product.sku ||
        values.currentName !== product.name ||
        values.businessLine !== product.businessLine ||
        values.currentStatus !== product.status ||
        values.baseline !== identityBaseline(product))
    )
      errors.push('STALE_OR_CHANGED_IDENTITY');
    if (
      PRODUCT_WORKBOOK_HEADERS.some(
        (key) => typeof values[key] !== 'string' || values[key].length > 4000,
      )
    )
      errors.push('INVALID_CELL');
    for (const channel of ['catalogBeauty', 'catalogStyle', 'web'] as const)
      if (!['true', 'false'].includes(values[channel])) errors.push(`INVALID_${channel}`);
    if (
      (values.catalogBeauty === 'true' && values.businessLine !== 'BEAUTY_CARE') ||
      (values.catalogStyle === 'true' && values.businessLine !== 'STYLE')
    )
      errors.push('CHANNEL_BUSINESS_LINE_MISMATCH');
    if (values.statusCandidate && !statuses.includes(values.statusCandidate))
      errors.push('INVALID_STATUS');
    if (values.candidateName && values.candidateName !== values.currentName)
      pending.push('NAME_EVIDENCE_AND_HUMAN_REVIEW_REQUIRED');
    if (values.descriptionCandidate) pending.push('DESCRIPTION_EVIDENCE_AND_HUMAN_REVIEW_REQUIRED');
    if (values.statusCandidate) pending.push('STATUS_CHANGE_NOT_AUTHORIZED');
    if ([values.catalogBeauty, values.catalogStyle, values.web].includes('true'))
      pending.push('CHANNEL_RIGHTS_AND_APPROVAL_REQUIRED');
    return { row: index + 2, values: { ...values }, errors, pending };
  });
}
export async function exportProductWorkbook(rows: readonly WorkbookRow[]): Promise<Uint8Array> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Products', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRow([...PRODUCT_WORKBOOK_HEADERS]);
  for (const row of rows) sheet.addRow(PRODUCT_WORKBOOK_HEADERS.map((header) => row[header]));
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 24;
  });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
export async function readProductWorkbook(data: Uint8Array): Promise<WorkbookRow[]> {
  if (!data.length || data.length > 5 * 1024 * 1024) throw new Error('XLSX_FILE_LIMIT');
  // Bound advertised inflated ZIP size before ExcelJS allocates worksheet contents. ZIP64 is outside this intake.
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let end = -1;
  for (let offset = data.length - 22; offset >= Math.max(0, data.length - 65557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error('XLSX_ZIP_INVALID');
  const entries = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true),
    inflated = 0;
  if (!entries || entries > 1000) throw new Error('XLSX_ZIP_LIMIT');
  for (let entry = 0; entry < entries; entry++) {
    if (offset + 46 > data.length || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error('XLSX_ZIP_INVALID');
    inflated += view.getUint32(offset + 24, true);
    if (inflated > 20 * 1024 * 1024) throw new Error('XLSX_ZIP_LIMIT');
    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
  }
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  if (workbook.worksheets.length !== 1) throw new Error('XLSX_SINGLE_PRODUCTS_SHEET_REQUIRED');
  const sheet = workbook.getWorksheet('Products');
  if (!sheet || sheet.rowCount > 5001 || sheet.columnCount !== PRODUCT_WORKBOOK_HEADERS.length)
    throw new Error('XLSX_SHAPE_INVALID');
  const scalar = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (!['string', 'number', 'boolean'].includes(typeof value))
      throw new Error('XLSX_FORMULA_OR_COMPLEX_CELL_REJECTED');
    const text = String(value);
    if (text.length > 4000) throw new Error('XLSX_CELL_LIMIT');
    return text;
  };
  for (let i = 0; i < PRODUCT_WORKBOOK_HEADERS.length; i++)
    if (scalar(sheet.getRow(1).getCell(i + 1).value) !== PRODUCT_WORKBOOK_HEADERS[i])
      throw new Error('XLSX_HEADERS_INVALID');
  const rows: WorkbookRow[] = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const record = Object.fromEntries(
      PRODUCT_WORKBOOK_HEADERS.map((header, index) => [
        header,
        scalar(row.getCell(index + 1).value),
      ]),
    ) as WorkbookRow;
    if (Object.values(record).some(Boolean)) rows.push(record);
  });
  return rows;
}
