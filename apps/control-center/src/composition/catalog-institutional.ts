import { getBrowserSupabaseClient } from '@lihen/database';

export interface InstitutionalPurchaseSection {
  key: string;
  label: string;
  body: string;
}

export type InstitutionalQrSourceType = 'URL' | 'PAYLOAD' | 'IMAGE';

export interface InstitutionalPaymentMethod {
  id: string;
  label: string;
  identifier: string;
  qrSourceType: InstitutionalQrSourceType;
  qrValue: string;
  qrFileName?: string;
  qrMimeType?: string;
  enabled: boolean;
  sortOrder: number;
}

export interface InstitutionalChannels {
  storefrontUrl: string;
  whatsappUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  whatsappCommunityUrl: string;
}

export interface CatalogInstitutionalContent {
  aboutTitle: string;
  aboutBody: string;
  aboutImageUrl: string;
  purchaseTitle: string;
  purchaseIntro: string;
  purchaseSections: readonly InstitutionalPurchaseSection[];
  legalName: string;
  taxId: string;
  locationText: string;
  paymentTitle: string;
  paymentMethods: readonly InstitutionalPaymentMethod[];
  connectTitle: string;
  connectMessage: string;
  channels: InstitutionalChannels;
  footerLabel: string;
  updatedAt: string | null;
}

interface InstitutionalRow {
  about_title: string;
  about_body: string;
  about_image_url: string | null;
  purchase_title: string;
  purchase_intro: string;
  purchase_sections: unknown;
  legal_name: string;
  tax_id: string | null;
  location_text: string | null;
  payment_title: string;
  payment_methods: unknown;
  connect_title: string;
  connect_message: string;
  channels: unknown;
  footer_label: string;
  updated_at?: string | null;
  captured_at?: string | null;
}

function db() {
  return getBrowserSupabaseClient(import.meta.env);
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseSections(value: unknown): readonly InstitutionalPurchaseSection[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const row = objectRecord(item);
    return {
      key: stringValue(row.key) || `section-${index + 1}`,
      label: stringValue(row.label),
      body: stringValue(row.body),
    };
  });
}

function parsePayments(value: unknown): readonly InstitutionalPaymentMethod[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const row = objectRecord(item);
    const source = stringValue(row.qrSourceType || row.qr_source_type);
    return {
      id: stringValue(row.id) || `payment-${index + 1}`,
      label: stringValue(row.label),
      identifier: stringValue(row.identifier),
      qrSourceType:
        source === 'PAYLOAD' || source === 'IMAGE' ? source : 'URL',
      qrValue: stringValue(row.qrValue || row.qr_value),
      qrFileName: stringValue(row.qrFileName || row.qr_file_name),
      qrMimeType: stringValue(row.qrMimeType || row.qr_mime_type),
      enabled: typeof row.enabled === 'boolean' ? row.enabled : true,
      sortOrder:
        typeof row.sortOrder === 'number'
          ? row.sortOrder
          : typeof row.sort_order === 'number'
            ? row.sort_order
            : index,
    };
  });
}

function parseChannels(value: unknown): InstitutionalChannels {
  const row = objectRecord(value);
  return {
    storefrontUrl: stringValue(row.storefront_url),
    whatsappUrl: stringValue(row.whatsapp_url),
    instagramUrl: stringValue(row.instagram_url),
    tiktokUrl: stringValue(row.tiktok_url),
    facebookUrl: stringValue(row.facebook_url),
    whatsappCommunityUrl: stringValue(row.whatsapp_community_url),
  };
}

function parseContent(row: InstitutionalRow): CatalogInstitutionalContent {
  return {
    aboutTitle: row.about_title,
    aboutBody: row.about_body,
    aboutImageUrl: row.about_image_url ?? '',
    purchaseTitle: row.purchase_title,
    purchaseIntro: row.purchase_intro,
    purchaseSections: parseSections(row.purchase_sections),
    legalName: row.legal_name,
    taxId: row.tax_id ?? '',
    locationText: row.location_text ?? '',
    paymentTitle: row.payment_title,
    paymentMethods: parsePayments(row.payment_methods),
    connectTitle: row.connect_title,
    connectMessage: row.connect_message,
    channels: parseChannels(row.channels),
    footerLabel: row.footer_label,
    updatedAt: row.updated_at ?? row.captured_at ?? null,
  };
}

function serializeContent(content: CatalogInstitutionalContent) {
  return {
    about_title: content.aboutTitle,
    about_body: content.aboutBody,
    about_image_url: content.aboutImageUrl || null,
    purchase_title: content.purchaseTitle,
    purchase_intro: content.purchaseIntro,
    purchase_sections: content.purchaseSections.map((item) => ({
      key: item.key,
      label: item.label,
      body: item.body,
    })),
    legal_name: content.legalName,
    tax_id: content.taxId || null,
    location_text: content.locationText || null,
    payment_title: content.paymentTitle,
    payment_methods: content.paymentMethods.map((item) => ({
      id: item.id,
      label: item.label,
      identifier: item.identifier,
      qrSourceType: item.qrSourceType,
      qrValue: item.qrValue,
      qrFileName: item.qrFileName || null,
      qrMimeType: item.qrMimeType || null,
      enabled: item.enabled,
      sortOrder: item.sortOrder,
    })),
    connect_title: content.connectTitle,
    connect_message: content.connectMessage,
    channels: {
      storefront_url: content.channels.storefrontUrl || null,
      whatsapp_url: content.channels.whatsappUrl || null,
      instagram_url: content.channels.instagramUrl || null,
      tiktok_url: content.channels.tiktokUrl || null,
      facebook_url: content.channels.facebookUrl || null,
      whatsapp_community_url: content.channels.whatsappCommunityUrl || null,
    },
    footer_label: content.footerLabel,
  };
}

export const catalogInstitutionalComposition = {
  async getCurrent(): Promise<CatalogInstitutionalContent> {
    const { data, error } = await db().rpc(
      'get_catalog_institutional_content_controlled',
    );
    if (error) throw error;
    const row = ((data ?? []) as InstitutionalRow[])[0];
    if (!row) throw new Error('No existe configuración institucional.');
    return parseContent(row);
  },

  async save(content: CatalogInstitutionalContent): Promise<void> {
    const { error } = await db().rpc(
      'update_catalog_institutional_content_controlled',
      { p_payload: serializeContent(content) },
    );
    if (error) throw error;
  },

  async captureSnapshot(versionId: string): Promise<void> {
    const { error } = await db().rpc(
      'capture_catalog_institutional_snapshot_controlled',
      { p_catalog_version_id: versionId },
    );
    if (error) throw error;
  },

  async getSnapshot(
    versionId: string,
  ): Promise<CatalogInstitutionalContent | null> {
    const { data, error } = await db().rpc(
      'get_catalog_institutional_snapshot_controlled',
      { p_catalog_version_id: versionId },
    );
    if (error) throw error;
    const row = ((data ?? []) as InstitutionalRow[])[0];
    return row ? parseContent(row) : null;
  },

  async uploadAsset(file: File, slot: string): Promise<string> {
    const safeSlot = slot.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `institutional/${safeSlot}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error } = await db().storage
      .from('catalog-assets')
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
    if (error) throw error;
    const { data } = db().storage.from('catalog-assets').getPublicUrl(path);
    return data.publicUrl;
  },

  async generateQrSvg(value: string, width = 256): Promise<string> {
    const { data, error } = await db().functions.invoke<{
      svg?: string;
      error?: string;
    }>('catalog-qr', {
      body: { value, width },
    });
    if (error) throw error;
    if (!data?.svg) throw new Error(data?.error || 'No fue posible generar el QR.');
    return data.svg;
  },
};
