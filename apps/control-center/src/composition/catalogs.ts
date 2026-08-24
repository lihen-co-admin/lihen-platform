import { getBrowserSupabaseClient } from '@lihen/database';

export interface CatalogCandidate {
  productId: string;
  sku: string | null;
  catalogCode: string | null;
  productName: string;
  businessLine: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  salePrice: number;
  productStatus: string;
  imageUrl: string | null;
  eligible: boolean;
  blockingReasons: readonly string[];
}

export interface CatalogVersionSummary {
  id: string;
  code: string;
  title: string;
  versionLabel: string;
  status: string;
  totalEntries: number;
  visibleEntries: number;
  activatedAt: string | null;
  artifactUrl: string | null;
  artifactSha256: string | null;
  artifactPageCount: number | null;
  artifactSizeBytes: number | null;
  rendererVersion: string | null;
  publicationStatus: string;
}

export interface CatalogValidationCheck {
  checkName: string;
  status: string;
  issueCount: number;
}

export interface CatalogRenderEntry {
  catalogVersionId: string;
  catalogCode: string;
  catalogTitle: string;
  versionLabel: string;
  catalogStatus: string;
  catalogEntryId: string;
  productId: string;
  sku: string | null;
  productCatalogCode: string | null;
  slug: string;
  productName: string;
  businessLine: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  salePrice: number;
  imageUrl: string;
  imageAlt: string | null;
  sortOrder: number;
}

interface CatalogCandidateRow {
  product_id: string;
  sku: string | null;
  catalog_code: string | null;
  product_name: string;
  business_line: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  sale_price: number | string;
  product_status: string;
  image_url: string | null;
  eligible: boolean;
  blocking_reasons: string[] | null;
}

interface CatalogVersionSummaryRow {
  id: string;
  code: string;
  title: string;
  version_label: string;
  status: string;
  total_entries: number | string;
  visible_entries: number | string;
  activated_at: string | null;
}

interface CatalogPublicationRow {
  catalog_version_id: string;
  artifact_url: string | null;
  artifact_sha256: string | null;
  artifact_page_count: number | string | null;
  artifact_size_bytes: number | string | null;
  renderer_version: string | null;
  publication_status: string;
}

export interface PdfArtifactInspection {
  sha256: string;
  pageCount: number;
  sizeBytes: number;
}

const PDF_ARTIFACT_BUCKET = 'catalog-pdf-artifacts';
const PDF_RENDERER_VERSION = 'catalog-renderer-v2-institutional';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeArtifactName(name: string): string {
  const normalized = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

export async function inspectPdfArtifact(file: File): Promise<PdfArtifactInspection> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) throw new Error('Selecciona un archivo PDF válido.');
  if (file.size <= 0 || file.size > 100 * 1024 * 1024) throw new Error('El PDF debe pesar entre 1 byte y 100 MiB.');

  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const source = new TextDecoder('latin1').decode(buffer);
  const pageCount = source.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  if (pageCount <= 0) throw new Error('No fue posible determinar el número de páginas del PDF.');

  return {
    sha256: bytesToHex(new Uint8Array(digest)),
    pageCount,
    sizeBytes: file.size,
  };
}

interface CatalogValidationRow {
  check_name: string;
  status: string;
  issue_count: number | string;
}

interface CatalogRenderRow {
  catalog_version_id: string;
  catalog_code: string;
  catalog_title: string;
  version_label: string;
  catalog_status: string;
  catalog_entry_id: string;
  product_id: string;
  sku: string | null;
  product_catalog_code: string | null;
  slug: string;
  product_name: string;
  business_line: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  sale_price: number | string;
  image_url: string;
  image_alt: string | null;
  sort_order: number | string;
}

function db() {
  return getBrowserSupabaseClient(import.meta.env);
}

export const catalogsComposition = {

  async getRenderEntries(
    versionId: string,
  ): Promise<readonly CatalogRenderEntry[]> {
    const pageSize = 500;
    const rows: CatalogRenderRow[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await db()
        .from('catalog_pdf_render_projection')
        .select(
          'catalog_version_id,catalog_code,catalog_title,version_label,catalog_status,catalog_entry_id,product_id,sku,product_catalog_code,slug,product_name,business_line,brand,category,subcategory,description,sale_price,image_url,image_alt,sort_order',
        )
        .eq('catalog_version_id', versionId)
        .order('sort_order', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      const page = (data ?? []) as CatalogRenderRow[];
      rows.push(...page);

      if (page.length < pageSize) {
        break;
      }

      offset += pageSize;
    }

    return rows.map((item) => ({
      catalogVersionId: item.catalog_version_id,
      catalogCode: item.catalog_code,
      catalogTitle: item.catalog_title,
      versionLabel: item.version_label,
      catalogStatus: item.catalog_status,
      catalogEntryId: item.catalog_entry_id,
      productId: item.product_id,
      sku: item.sku,
      productCatalogCode: item.product_catalog_code,
      slug: item.slug,
      productName: item.product_name,
      businessLine: item.business_line,
      brand: item.brand,
      category: item.category,
      subcategory: item.subcategory,
      description: item.description,
      salePrice: Number(item.sale_price),
      imageUrl: item.image_url,
      imageAlt: item.image_alt,
      sortOrder: Number(item.sort_order),
    }));
  },
  async getCandidates(): Promise<readonly CatalogCandidate[]> {
    const pageSize = 500;
    const rows: CatalogCandidateRow[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await db().rpc(
        'get_pdf_catalog_candidates_page_controlled',
        {
          p_limit: pageSize,
          p_offset: offset,
        },
      );

      if (error) throw error;

      const page = (data ?? []) as CatalogCandidateRow[];
      rows.push(...page);

      if (page.length < pageSize) {
        break;
      }

      offset += pageSize;
    }

    return rows.map((item) => ({
      productId: item.product_id,
      sku: item.sku,
      catalogCode: item.catalog_code,
      productName: item.product_name,
      businessLine: item.business_line,
      brand: item.brand,
      category: item.category,
      subcategory: item.subcategory,
      salePrice: Number(item.sale_price),
      productStatus: item.product_status,
      imageUrl: item.image_url,
      eligible: Boolean(item.eligible),
      blockingReasons: item.blocking_reasons ?? [],
    }));
  },

  async listVersions(): Promise<readonly CatalogVersionSummary[]> {
    const { data, error } = await db()
      .from('catalog_version_summary')
      .select('id,code,title,version_label,status,total_entries,visible_entries,activated_at')
      .eq('source_type', 'PDF')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const { data: publicationData, error: publicationError } = await db()
      .from('catalog_pdf_publication_status')
      .select('catalog_version_id,artifact_url,artifact_sha256,artifact_page_count,artifact_size_bytes,renderer_version,publication_status');

    if (publicationError) throw publicationError;

    const publicationRows = (publicationData ?? []) as CatalogPublicationRow[];
    const publicationById = new Map(
      publicationRows.map((item) => [item.catalog_version_id, item]),
    );

    const rows = (data ?? []) as CatalogVersionSummaryRow[];

    return rows.map((item) => {
      const publication = publicationById.get(item.id);

      return {
        id: item.id,
        code: item.code,
        title: item.title,
        versionLabel: item.version_label,
        status: item.status,
        totalEntries: Number(item.total_entries),
        visibleEntries: Number(item.visible_entries),
        activatedAt: item.activated_at,
        artifactUrl: publication?.artifact_url ?? null,
        artifactSha256: publication?.artifact_sha256 ?? null,
        artifactPageCount: publication?.artifact_page_count == null ? null : Number(publication.artifact_page_count),
        artifactSizeBytes: publication?.artifact_size_bytes == null ? null : Number(publication.artifact_size_bytes),
        rendererVersion: publication?.renderer_version ?? null,
        publicationStatus: publication?.publication_status ?? item.status,
      };
    });
  },

  async createDraft(input: {
    code: string;
    title: string;
    versionLabel: string;
    sourceReference?: string | null;
  }): Promise<string> {
    const { data, error } = await db().rpc('create_pdf_catalog_version_controlled', {
      p_code: input.code,
      p_title: input.title,
      p_version_label: input.versionLabel,
      p_source_reference: input.sourceReference ?? null,
    });

    if (error) throw error;

    return String(data);
  },

  async replaceSelection(
    versionId: string,
    productIds: readonly string[],
  ): Promise<number> {
    const { data, error } = await db().rpc('replace_pdf_catalog_selection_controlled', {
      p_catalog_version_id: versionId,
      p_product_ids: [...productIds],
    });

    if (error) throw error;

    return Number(data);
  },

  async validate(
    versionId: string,
  ): Promise<readonly CatalogValidationCheck[]> {
    const { data, error } = await db().rpc('validate_pdf_catalog_version_controlled', {
      p_catalog_version_id: versionId,
    });

    if (error) throw error;

    const rows = (data ?? []) as CatalogValidationRow[];

    return rows.map((item) => ({
      checkName: item.check_name,
      status: item.status,
      issueCount: Number(item.issue_count),
    }));
  },

  async activate(versionId: string): Promise<void> {
    const { error } = await db().rpc('activate_pdf_catalog_version_controlled', {
      p_catalog_version_id: versionId,
    });

    if (error) throw error;
  },


  async registerPdfArtifact(
    versionId: string,
    file: File,
    inspection: PdfArtifactInspection,
  ): Promise<void> {
    const path = `catalogs/${versionId}/${Date.now()}-${safeArtifactName(file.name)}`;
    const client = db();
    const { error: uploadError } = await client.storage
      .from(PDF_ARTIFACT_BUCKET)
      .upload(path, file, { contentType: 'application/pdf', upsert: false });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = client.storage
      .from(PDF_ARTIFACT_BUCKET)
      .getPublicUrl(path);

    const { error } = await client.rpc('register_pdf_catalog_artifact_controlled', {
      p_catalog_version_id: versionId,
      p_artifact_url: publicUrlData.publicUrl,
      p_artifact_sha256: inspection.sha256,
      p_page_count: inspection.pageCount,
      p_size_bytes: inspection.sizeBytes,
      p_renderer_version: PDF_RENDERER_VERSION,
    });

    if (error) throw error;
  },

  async archive(versionId: string): Promise<void> {
    const { error } = await db().rpc('archive_pdf_catalog_version_controlled', {
      p_catalog_version_id: versionId,
    });

    if (error) throw error;
  },
};
