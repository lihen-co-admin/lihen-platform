import type { SearchProductIdentity, VerifiedProductImage } from '@lihen/intelligence-core';

/** Evidence envelope for a future SERVER-owned ingestion contract. This is a request, never a
 * browser-issued permission. No existing endpoint verifies it, so every external attempt is blocked.
 * The server must obtain/hash source bytes itself and bind its WebP derivative to the same operation.
 */
export interface ExternalProductImageSelection {
  readonly kind: 'EXTERNAL_VERIFIED';
  readonly productId: string;
  readonly identity: SearchProductIdentity;
  readonly identityFingerprint: string;
  readonly candidateId: string;
  readonly resource: {
    readonly url: string;
    readonly sourceSha256: string;
    readonly webpSha256: string;
  };
  /** Contains source URL/extracts, exact reference/variant, authority evidence and rights expiry. */
  readonly assessment: VerifiedProductImage;
  readonly operationKey: string;
  readonly ownerId: string;
  readonly reviewSessionId: string;
  readonly humanApproval: {
    readonly approvalId: string;
    readonly actorId: string;
    readonly productId: string;
    readonly identityFingerprint: string;
    readonly candidateId: string;
    readonly sourceSha256: string;
    readonly operationKey: string;
    readonly approvedAt: string;
    readonly expiresAt: string;
  };
}

export const EXTERNAL_PRODUCT_IMAGE_SAVE_BLOCKED = 'EXTERNAL_IMAGE_SAVE_SERVER_VERIFIER_REQUIRED';
export const EXTERNAL_PRODUCT_IMAGE_SAVE_NOTICE =
  'Guardado externo bloqueado: falta un verificador servidor que vincule producto, variante, contenido, autoridad, derechos y aprobación vigente en el límite de escritura. La revisión local no autoriza descargas ni guardados.';

/** Compatibility guard for the MANUAL queue, NOT a security verifier or a server receipt validator.
 * No flag, client hash, evidence object or approval can enable external ingestion here.
 * Validate the complete batch and retry journal before any side effect, including partial batches.
 * Removing all markers from arbitrary bytes cannot be detected client-side: the panel therefore
 * has NO transfer callback and no external downloader. Manual uploads retain their existing policy.
 */
export function assertManualWebpQueueOnly(entries: readonly object[]): void {
  for (const entry of entries) {
    if ('externalSelection' in entry || ('origin' in entry && entry.origin !== 'MANUAL')) {
      throw new Error(EXTERNAL_PRODUCT_IMAGE_SAVE_BLOCKED);
    }
  }
}
