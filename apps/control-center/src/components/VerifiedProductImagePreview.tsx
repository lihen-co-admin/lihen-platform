import { useState } from 'react';
import { reviewProductPhotograph, type VerifiedProductImage } from '@lihen/intelligence-core';

/** Preview is not a content hash attestation and never authorizes a WebP save. */
export function VerifiedProductImagePreview({ image }: { readonly image: VerifiedProductImage }) {
  const [failed, setFailed] = useState(false);
  let https = false;
  try {
    const url = new URL(image.imageUrl);
    https = url.protocol === 'https:' && !url.username && !url.password && !url.hash;
  } catch {
    /* Fail closed. */
  }
  const verified =
    reviewProductPhotograph(image, false, false, new Date().toISOString()) === 'RIGHTS_VERIFIED';
  if (!https || !verified)
    return <p>Vista previa bloqueada: identidad, autoridad o derechos vigentes no verificados.</p>;
  if (failed)
    return (
      <p role="alert">
        No se pudo leer la fotografía. Se requiere nueva revisión; no puede guardarse.
      </p>
    );
  return (
    <figure>
      <img
        src={image.imageUrl}
        alt={`Candidato de ${image.identity.productName}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
      <figcaption>
        Vista previa remota. El guardado exige verificar en servidor el mismo contenido y su
        autorización.
      </figcaption>
    </figure>
  );
}
