import { describe, expect, it } from 'vitest';
import {
  createSupplierSourceDocument,
  createSupplierSourceIntakeSnapshot,
  createSupplierSourceRecord,
} from '../src/domain/supplier-source-intake';

const SHA = 'a'.repeat(64);

describe('WAVE 6 / GAP-018 Supplier Document Canonical Intake', () => {
  it('creates a canonical RECEIVED document and normalizes SHA-256', () => {
    const document = createSupplierSourceDocument({
      id: 'document-1',
      sourceName: '  catalogo proveedor.pdf  ',
      sourceType: 'PDF',
      sourceSha256: SHA.toUpperCase(),
      sourceSizeBytes: 100,
      businessLine: 'BEAUTY_CARE',
    });

    expect(document).toMatchObject({
      id: 'document-1',
      sourceName: 'catalogo proveedor.pdf',
      sourceType: 'PDF',
      sourceSha256: SHA,
      sourceSizeBytes: 100,
      businessLine: 'BEAUTY_CARE',
      status: 'RECEIVED',
      supplierId: null,
      extractionStrategyVersion: null,
    });
  });

  it('allows unresolved supplier and business line during canonical registration', () => {
    const document = createSupplierSourceDocument({
      id: 'document-1',
      sourceName: 'lista.csv',
      sourceType: 'CSV',
      sourceSha256: SHA,
    });

    expect(document.supplierId).toBeNull();
    expect(document.businessLine).toBeNull();
  });

  it('rejects invalid document hash, size and source date', () => {
    expect(() =>
      createSupplierSourceDocument({
        id: 'document-1',
        sourceName: 'catalogo.pdf',
        sourceType: 'PDF',
        sourceSha256: 'bad',
      }),
    ).toThrow('SUPPLIER_SOURCE_SHA256_INVALID');

    expect(() =>
      createSupplierSourceDocument({
        id: 'document-1',
        sourceName: 'catalogo.pdf',
        sourceType: 'PDF',
        sourceSha256: SHA,
        sourceSizeBytes: -1,
      }),
    ).toThrow('SUPPLIER_SOURCE_SIZE_INVALID');

    expect(() =>
      createSupplierSourceDocument({
        id: 'document-1',
        sourceName: 'catalogo.pdf',
        sourceType: 'PDF',
        sourceSha256: SHA,
        sourceDate: '2026-02-31',
      }),
    ).toThrow('SUPPLIER_SOURCE_DATE_INVALID');
  });

  it('creates source records as evidence without mutating canonical Product Master', () => {
    const record = createSupplierSourceRecord({
      id: 'record-1',
      documentId: 'document-1',
      sourceRowKey: 'page-2:item-4',
      sourcePage: 2,
      productName: 'Producto proveedor',
      brandText: 'Marca observada',
      unitCost: 18000,
      extractionConfidence: 0.92,
      extractionStatus: 'EXTRACTED',
      evidence: { page: 2, origin: 'supplier-document' },
    });

    expect(record.productName).toBe('Producto proveedor');
    expect(record.unitCost).toBe(18000);
    expect(record.extractionStatus).toBe('EXTRACTED');
    expect(record.evidence).toEqual({
      page: 2,
      origin: 'supplier-document',
    });
  });

  it('requires product name for an EXTRACTED record', () => {
    expect(() =>
      createSupplierSourceRecord({
        id: 'record-1',
        documentId: 'document-1',
        sourceRowKey: 'row-1',
        extractionStatus: 'EXTRACTED',
      }),
    ).toThrow('SUPPLIER_SOURCE_EXTRACTED_PRODUCT_NAME_REQUIRED');
  });

  it('validates confidence and non-negative observational numeric fields', () => {
    expect(() =>
      createSupplierSourceRecord({
        id: 'record-1',
        documentId: 'document-1',
        sourceRowKey: 'row-1',
        extractionConfidence: 1.1,
      }),
    ).toThrow('SUPPLIER_SOURCE_CONFIDENCE_INVALID');

    expect(() =>
      createSupplierSourceRecord({
        id: 'record-1',
        documentId: 'document-1',
        sourceRowKey: 'row-1',
        unitCost: -1,
      }),
    ).toThrow('SUPPLIER_SOURCE_UNIT_COST_INVALID');

    expect(() =>
      createSupplierSourceRecord({
        id: 'record-1',
        documentId: 'document-1',
        sourceRowKey: 'row-1',
        quantityHint: 1.5,
      }),
    ).toThrow('SUPPLIER_SOURCE_QUANTITY_INVALID');
  });

  it('requires all records in a snapshot to belong to the same document', () => {
    const document = createSupplierSourceDocument({
      id: 'document-1',
      sourceName: 'catalogo.pdf',
      sourceType: 'PDF',
      sourceSha256: SHA,
    });
    const record = createSupplierSourceRecord({
      id: 'record-1',
      documentId: 'document-2',
      sourceRowKey: 'row-1',
    });

    expect(() =>
      createSupplierSourceIntakeSnapshot(document, [record]),
    ).toThrow('SUPPLIER_SOURCE_RECORD_DOCUMENT_MISMATCH');
  });

  it('rejects duplicate record ids and duplicate source row keys', () => {
    const document = createSupplierSourceDocument({
      id: 'document-1',
      sourceName: 'catalogo.pdf',
      sourceType: 'PDF',
      sourceSha256: SHA,
    });
    const recordA = createSupplierSourceRecord({
      id: 'record-1',
      documentId: document.id,
      sourceRowKey: 'row-1',
    });
    const duplicateId = createSupplierSourceRecord({
      id: 'record-1',
      documentId: document.id,
      sourceRowKey: 'row-2',
    });
    const duplicateRow = createSupplierSourceRecord({
      id: 'record-2',
      documentId: document.id,
      sourceRowKey: 'row-1',
    });

    expect(() =>
      createSupplierSourceIntakeSnapshot(document, [recordA, duplicateId]),
    ).toThrow('SUPPLIER_SOURCE_RECORD_ID_DUPLICATE');

    expect(() =>
      createSupplierSourceIntakeSnapshot(document, [recordA, duplicateRow]),
    ).toThrow('SUPPLIER_SOURCE_ROW_KEY_DUPLICATE');
  });

  it('orders records deterministically by page, row key and id', () => {
    const document = createSupplierSourceDocument({
      id: 'document-1',
      sourceName: 'catalogo.pdf',
      sourceType: 'PDF',
      sourceSha256: SHA,
    });
    const records = [
      createSupplierSourceRecord({
        id: 'record-c',
        documentId: document.id,
        sourceRowKey: 'row-c',
        sourcePage: null,
      }),
      createSupplierSourceRecord({
        id: 'record-b',
        documentId: document.id,
        sourceRowKey: 'row-b',
        sourcePage: 2,
      }),
      createSupplierSourceRecord({
        id: 'record-a',
        documentId: document.id,
        sourceRowKey: 'row-a',
        sourcePage: 1,
      }),
    ];

    const snapshot = createSupplierSourceIntakeSnapshot(document, records);

    expect(snapshot.records.map((record) => record.id)).toEqual([
      'record-a',
      'record-b',
      'record-c',
    ]);
  });
});
