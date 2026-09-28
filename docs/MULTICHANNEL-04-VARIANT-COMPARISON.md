# MULTICHANNEL-04 — Comparación de variantes

Base local: `59f8e90cebf5c18483b7abeb539744f35e44b734` (MULTICHANNEL-03 cerrado).

El detalle editorial permite comparar y abrir las variantes del mismo contenido en la biblioteca leída. La asociación usa exclusivamente `campaignId` y `campaignContentId` de los contratos existentes; no depende del nombre de campaña, del producto ni del filtro de biblioteca. Los registros sin identidad de agrupación se muestran individualmente.

Cada tarjeta muestra canal, estado observado, copy, CTA, hashtags, cantidad de referencias de media y fecha en America/Bogota. Incluye variantes canceladas para conservar el contexto editorial y señala la variante actual. La ausencia de hermanas se limita explícitamente a la biblioteca leída, sin presumir que la respuesta remota sea exhaustiva.

La comparación y navegación son locales y no modifican estados. No requieren migraciones ni deploy de Edge Functions. No crean intentos, publican, activan scheduler ni envían WhatsApp. PROD HOLD; FREE_ONLY.
