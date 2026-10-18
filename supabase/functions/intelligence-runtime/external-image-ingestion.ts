import type {
  ExternalImageBinding,
  ServerImageEvidence,
  ServerImageVerificationPorts,
} from './external-image-verification.ts';
import { verifyExternalImageOnServer } from './external-image-verification.ts';
import { downloadOfficialImage, inspectExternalPng } from './external-image-download.ts';

/** Structural boundary keeps this module testable without credentials or a production SDK client. */
export interface ExternalImageBackend {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        bytes: Uint8Array,
        options: { contentType: string; upsert: false },
      ): PromiseLike<{ error: unknown }>;
      download(path: string): PromiseLike<{ data: Blob | null; error: unknown }>;
    };
  };
}
interface Context {
  evidence: ServerImageEvidence;
  imageId: string;
  result: Record<string, unknown> | null;
}
async function hash(bytes: Uint8Array): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
async function rpc(
  client: ExternalImageBackend,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`EXTERNAL_IMAGE_RPC_FAILED:${name}`);
  return data;
}

/** Server entry, not a browser route. projectUrl and actorId come from server config + getUser(token).
 * No evidence or permission objects from the browser. Approval provisioning is a separate reviewed
 * server workflow; only durable service-owned records may authorize an ingestion operation.
 */
export async function ingestAuthorizedExternalImage(input: {
  projectUrl: string;
  actorId: string;
  mode?: 'SYNTHETIC_TEST';
  candidateId: string;
  operationKey: string;
  client: ExternalImageBackend;
  convert: ServerImageVerificationPorts['convertToWebp'];
  retrieve?: ServerImageVerificationPorts['retrieveSource'];
}): Promise<unknown> {
  if (input.projectUrl !== 'https://vnmkupzptujtywnnabkp.supabase.co' || !input.actorId)
    throw new Error('EXTERNAL_IMAGE_DEV_ACTOR_REQUIRED');
  const synthetic = input.mode === 'SYNTHETIC_TEST';
  const readRpc = synthetic
    ? 'read_synthetic_image_authorization'
    : 'read_external_image_authorization';
  const finalizeRpc = synthetic
    ? 'finalize_synthetic_product_webp'
    : 'finalize_external_product_webp';
  const args = {
    p_candidate_id: input.candidateId,
    p_operation_key: input.operationKey,
    p_actor_id: input.actorId,
  };
  const load = async (): Promise<Context> => {
    const raw = (await rpc(input.client, readRpc, args)) as Context;
    if (!raw?.evidence || !raw.imageId || raw.evidence.binding.actorId !== input.actorId)
      throw new Error('EXTERNAL_IMAGE_CONTEXT_INVALID');
    if ((raw.evidence.mode === 'SYNTHETIC_TEST') !== synthetic)
      throw new Error('EXTERNAL_IMAGE_ROUTE_MODE_CONFLICT');
    return raw;
  };
  const initial = await load();
  // An uncertain prior result is reconciled by the durable transaction, never a new identity.
  if (initial.result) {
    const f = initial.result.fingerprint as Record<string, unknown>;
    return rpc(input.client, finalizeRpc, {
      ...args,
      p_evidence_revision: f.revision,
      p_sha256: f.sha256,
      p_byte_size: f.bytes,
      p_width: f.width,
      p_height: f.height,
    });
  }
  let prepared: { bytes: Uint8Array; width: number; height: number } | undefined;
  const ports: ServerImageVerificationPorts = {
    loadCurrentBinding: async (): Promise<ExternalImageBinding> => (await load()).evidence.binding,
    loadEvidence: async () => (await load()).evidence,
    retrieveSource: input.retrieve ?? downloadOfficialImage,
    convertToWebp: async (bytes) => {
      const dimensions = inspectExternalPng(bytes);
      prepared = await input.convert(bytes);
      if (prepared.width !== dimensions.width || prepared.height !== dimensions.height)
        throw new Error('EXTERNAL_IMAGE_DECODE_DIMENSIONS_CHANGED');
      return prepared;
    },
    projectUrl: input.projectUrl,
    now: () => Date.now(),
  };
  const verified = await verifyExternalImageOnServer(input.candidateId, input.operationKey, ports);
  if (!prepared || prepared.bytes.length > 3 * 1024 * 1024)
    throw new Error('EXTERNAL_IMAGE_WEBP_SIZE_INVALID');
  const path = `${synthetic ? '_synthetic_tests' : 'products'}/${initial.evidence.binding.productId}/${initial.imageId}/web/${verified.webpSha256}.webp`;
  const bucket = input.client.storage.from(
    synthetic ? 'lihen-product-originals' : 'lihen-product-web',
  );
  // Validate current authorization again immediately before upload. Registration repeats under locks.
  const beforeUpload = await load();
  if (JSON.stringify(beforeUpload.evidence) !== JSON.stringify(initial.evidence))
    throw new Error('EXTERNAL_IMAGE_EVIDENCE_CHANGED');
  const upload = await bucket.upload(path, prepared.bytes, {
    contentType: 'image/webp',
    upsert: false,
  });
  // Never delete on an uncertain response: an earlier registration may already reference the object.
  if (upload.error) {
    const existing = await bucket.download(path);
    if (
      existing.error ||
      !existing.data ||
      existing.data.size > 3 * 1024 * 1024 ||
      (await hash(new Uint8Array(await existing.data.arrayBuffer()))) !== verified.webpSha256
    )
      throw new Error('EXTERNAL_IMAGE_UPLOAD_UNCERTAIN_OR_CONFLICT');
  }
  // Always verify stored bytes, including nominally successful uploads; metadata is not a hash proof.
  const stored = await bucket.download(path);
  if (
    stored.error ||
    !stored.data ||
    stored.data.size !== prepared.bytes.length ||
    (await hash(new Uint8Array(await stored.data.arrayBuffer()))) !== verified.webpSha256
  )
    throw new Error('EXTERNAL_IMAGE_STORAGE_HASH_MISMATCH');
  return rpc(input.client, finalizeRpc, {
    ...args,
    p_evidence_revision: verified.evidenceRevision,
    p_sha256: verified.webpSha256,
    p_byte_size: prepared.bytes.length,
    p_width: prepared.width,
    p_height: prepared.height,
  });
}
