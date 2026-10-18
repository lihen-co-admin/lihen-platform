/** Server-only preflight. Not an authorization endpoint, receipt issuer or gallery writer.
 * Trusted loaders read durable server records, never deserialize browser assertions.
 * The disabled server ingestion route composes it with the transactional finalizer.
 */
import { SYNTHETIC_PRODUCT_ID, validateSyntheticTest } from './synthetic-image-test.ts';

export interface ExternalImageBinding {
  productId: string;
  sku: string;
  reference: string;
  presentation: string;
  tone: string;
  variant: string;
  productVersion: string;
  candidateId: string;
  operationKey: string;
  actorId: string;
  sourceUrl: string;
  sourceSha256: string;
}

export interface ServerImageEvidence {
  mode?: 'VERIFIED_EXTERNAL' | 'SYNTHETIC_TEST';
  synthetic?: {
    provenanceDocumentId: string;
    documentSha256: string;
    approvedAt: string;
    humanTestApproval: boolean;
  };
  binding: ExternalImageBinding;
  revision: string;
  sourcePageUrl: string;
  authority: { evidenceId: string; host: string; expiresAt: string; revoked: boolean };
  rights: { documentId: string; commercialUse: boolean; expiresAt: string; revoked: boolean };
  approval: {
    id: string;
    reviewerId: string;
    binding: ExternalImageBinding;
    expiresAt: string;
    revoked: boolean;
  };
  exactIdentityEvidenceId: string;
  authenticPhotographEvidenceId: string;
  contradictions: readonly string[];
  role: 'FRONT' | 'BACK' | 'ANGLE' | 'DETAIL' | 'IN_USE';
}

export interface ServerImageVerificationPorts {
  /** Must authenticate ACTIVE OWNER/ADMIN and read current Product Master + verified variant. */
  loadCurrentBinding(candidateId: string, operationKey: string): Promise<ExternalImageBinding>;
  /** Durable approved evidence, authority, rights and revocations; never browser input. */
  loadEvidence(candidateId: string): Promise<ServerImageEvidence>;
  /** Server egress boundary: exact HTTPS URL/host, no redirects, public DNS/IP validation,
   * DNS pinning against rebinding, bounded streaming/deadline, MIME and decoder restrictions.
   * A generic fetch() is NOT a compliant implementation. */
  retrieveSource(url: string, officialHost: string): Promise<Uint8Array>;
  /** Reuse catalog-pdf-webp-transformer with decoder resource limits in the integration adapter. */
  convertToWebp(bytes: Uint8Array): Promise<{ bytes: Uint8Array; width: number; height: number }>;
  projectUrl?: string;
  now(): number;
}

const bindingKeys: readonly (keyof ExternalImageBinding)[] = [
  'productId',
  'sku',
  'reference',
  'presentation',
  'tone',
  'variant',
  'productVersion',
  'candidateId',
  'operationKey',
  'actorId',
  'sourceUrl',
  'sourceSha256',
];
function sameBinding(a: ExternalImageBinding, b: ExternalImageBinding): boolean {
  return bindingKeys.every(
    (key) => typeof a[key] === 'string' && a[key].trim().length > 0 && a[key] === b[key],
  );
}
function fail(reason: string): never {
  throw new Error(`EXTERNAL_IMAGE_${reason}`);
}
function current(expiresAt: string, revoked: boolean, now: number): boolean {
  return !revoked && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) > now;
}
function validate(
  e: ServerImageEvidence,
  b: ExternalImageBinding,
  now: number,
  projectUrl?: string,
): void {
  const synthetic = e.mode === 'SYNTHETIC_TEST';
  if (synthetic) validateSyntheticTest(e, projectUrl, now);
  else if ((e.mode && e.mode !== 'VERIFIED_EXTERNAL') || b.productId === SYNTHETIC_PRODUCT_ID)
    fail('SYNTHETIC_COMMERCIAL_FORBIDDEN');
  if (!sameBinding(e.binding, b) || !sameBinding(e.approval.binding, b)) fail('BINDING_MISMATCH');
  if (
    !e.revision ||
    (!synthetic && (!e.exactIdentityEvidenceId || !e.authenticPhotographEvidenceId)) ||
    e.contradictions.length
  )
    fail('IDENTITY_UNVERIFIED');
  if (!/^[a-f0-9]{64}$/.test(b.sourceSha256)) fail('HASH_REQUIRED');
  let source: URL;
  let page: URL;
  try {
    source = new URL(b.sourceUrl);
    page = new URL(e.sourcePageUrl);
  } catch {
    fail('SOURCE_INVALID');
  }
  if (
    [source, page].some(
      (u) =>
        u.protocol !== 'https:' ||
        u.username ||
        u.password ||
        u.hash ||
        (u.port && u.port !== '443') ||
        u.hostname !== e.authority.host,
    )
  )
    fail('SOURCE_INVALID');
  if (!e.authority.evidenceId || !current(e.authority.expiresAt, e.authority.revoked, now))
    fail('AUTHORITY_INVALID');
  if (
    !e.rights.documentId ||
    (!synthetic && !e.rights.commercialUse) ||
    !current(e.rights.expiresAt, e.rights.revoked, now)
  )
    fail('RIGHTS_INVALID');
  if (
    !e.approval.id ||
    !e.approval.reviewerId ||
    !current(e.approval.expiresAt, e.approval.revoked, now)
  )
    fail('APPROVAL_INVALID');
  if (!['FRONT', 'BACK', 'ANGLE', 'DETAIL', 'IN_USE'].includes(e.role)) fail('ROLE_INVALID');
}
async function digest(bytes: Uint8Array): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer);
  return Array.from(new Uint8Array(result), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Returns a NON-SAVABLE diagnostic. No browser evidence, URL or content accepted as input.
 * Missing adapters are a hard operational block. Every retry re-reads all server evidence.
 * A successful preflight is insufficient to register: commit must repeat checks under a DB lock.
 */
export async function verifyExternalImageOnServer(
  candidateId: string,
  operationKey: string,
  ports?: ServerImageVerificationPorts,
): Promise<{
  status: 'VERIFIED_NOT_AUTHORIZED_FOR_SAVE';
  sourceSha256: string;
  webpSha256: string;
  evidenceRevision: string;
  role: ServerImageEvidence['role'];
}> {
  if (!ports) fail('TRUSTED_SERVER_ADAPTERS_REQUIRED');
  if (!candidateId.trim() || !operationKey.trim()) fail('OPERATION_REQUIRED');
  const binding = await ports.loadCurrentBinding(candidateId, operationKey);
  if (binding.candidateId !== candidateId || binding.operationKey !== operationKey)
    fail('BINDING_MISMATCH');
  const evidence = await ports.loadEvidence(candidateId);
  validate(evidence, binding, ports.now(), ports.projectUrl);
  // Detach the snapshot so a mutable adapter cannot alter the expected revision/binding in flight.
  const snapshot = JSON.stringify(evidence);
  const source = await ports.retrieveSource(binding.sourceUrl, evidence.authority.host);
  if (!source.byteLength || source.byteLength > 12 * 1024 * 1024) fail('SOURCE_SIZE_INVALID');
  if ((await digest(source)) !== binding.sourceSha256) fail('CONTENT_CHANGED');
  const converted = await ports.convertToWebp(source);
  const bytes = converted.bytes;
  const tag = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (
    bytes.length < 12 ||
    bytes.length > 12 * 1024 * 1024 ||
    tag(0, 4) !== 'RIFF' ||
    tag(8, 12) !== 'WEBP' ||
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8 !==
      bytes.length ||
    !Number.isInteger(converted.width) ||
    !Number.isInteger(converted.height) ||
    Math.min(converted.width, converted.height) < 600 ||
    converted.width * converted.height > 40_000_000
  )
    fail('QUALITY_INVALID');
  const latestBinding = await ports.loadCurrentBinding(candidateId, operationKey);
  const latest = await ports.loadEvidence(candidateId);
  validate(latest, latestBinding, ports.now(), ports.projectUrl);
  if (!sameBinding(binding, latestBinding) || snapshot !== JSON.stringify(latest))
    fail('EVIDENCE_CHANGED');
  return {
    status: 'VERIFIED_NOT_AUTHORIZED_FOR_SAVE',
    sourceSha256: await digest(source),
    webpSha256: await digest(bytes),
    evidenceRevision: latest.revision,
    role: latest.role,
  };
}
