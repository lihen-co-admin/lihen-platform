import { getBrowserSupabaseClient } from '@lihen/database';

export type CloudWorkspaceRegistryKind =
  | 'PRODUCT_IMAGE'
  | 'CATALOG_ASSET'
  | 'CATALOG_PDF'
  | 'STORAGE_OBJECT';

export interface CloudWorkspaceAsset {
  readonly storageObjectId: string;
  readonly bucketId: string;
  readonly objectPath: string;
  readonly registryKind: CloudWorkspaceRegistryKind;
  readonly variant: string | null;
  readonly productIdRef: string | null;
  readonly productImageIdRef: string | null;
  readonly catalogVersionIdRef: string | null;
  readonly assetNamespace: string | null;
  readonly assetKey: string | null;
  readonly mimeType: string | null;
  readonly byteSize: number | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
}

interface RegistryRow {
  readonly storage_object_id: string;
  readonly bucket_id: string;
  readonly object_path: string;
  readonly registry_kind: CloudWorkspaceRegistryKind;
  readonly variant: string | null;
  readonly product_id_ref: string | null;
  readonly product_image_id_ref: string | null;
  readonly catalog_version_id_ref: string | null;
  readonly asset_namespace: string | null;
  readonly asset_key: string | null;
  readonly mime_type: string | null;
  readonly byte_size: number | null;
  readonly created_at: string | null;
  readonly updated_at: string | null;
}

export interface CloudWorkspaceComposition {
  readonly source: 'public.unified_asset_artifact_registry';
  readonly readOnly: true;
  readonly listAssets: () => Promise<readonly CloudWorkspaceAsset[]>;
}

export function createCloudWorkspaceComposition(
  env: Record<string, unknown> = import.meta.env,
): CloudWorkspaceComposition {
  const client = getBrowserSupabaseClient(env);

  return {
    source: 'public.unified_asset_artifact_registry',
    readOnly: true,
    async listAssets() {
      const { data, error } = await client
        .from('unified_asset_artifact_registry')
        .select(
          [
            'storage_object_id',
            'bucket_id',
            'object_path',
            'registry_kind',
            'variant',
            'product_id_ref',
            'product_image_id_ref',
            'catalog_version_id_ref',
            'asset_namespace',
            'asset_key',
            'mime_type',
            'byte_size',
            'created_at',
            'updated_at',
          ].join(','),
        )
        .order('created_at', { ascending: false })
        .limit(2500);

      if (error) {
        throw new Error(`CLOUD_WORKSPACE_READ_FAILED: ${error.message}`);
      }

      const rows = (data ?? []) as unknown as readonly RegistryRow[];
      return rows.map((row) => ({
        storageObjectId: row.storage_object_id,
        bucketId: row.bucket_id,
        objectPath: row.object_path,
        registryKind: row.registry_kind,
        variant: row.variant,
        productIdRef: row.product_id_ref,
        productImageIdRef: row.product_image_id_ref,
        catalogVersionIdRef: row.catalog_version_id_ref,
        assetNamespace: row.asset_namespace,
        assetKey: row.asset_key,
        mimeType: row.mime_type,
        byteSize: row.byte_size,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },
  };
}

export const cloudWorkspaceComposition = createCloudWorkspaceComposition();
