# MULTICHANNEL-05 — Diagnóstico operativo por variante

Base: `9a338637829c1e0cac21f65bcee14fb2888332ab`, HEAD y referencia local
`origin/next-phase` coincidentes al inicio. Sin fetch ni cambios remotos.

## Gap elegido y evidencia

- `SocialContentPage.tsx` ya permite crear, revisar, aprobar, programar y comparar
  variantes. Su detalle enumeraba intentos sin explicar el siguiente paso operativo.
- `PrepareDuePublicationAttemptHandler` exige publicación aprobada, programación
  existente y aprobada y fecha alcanzada antes de crear un intento.
- `marketing-social-runtime/index.ts` limita ejecución a Facebook, Instagram Feed
  e Instagram Story y resuelve la **primera** referencia de imagen mediante el límite
  autorizado de Product Master. La lectura editorial no acredita esa autorización
  ni la configuración del proveedor.
- `social-dev-runtime.ts` contiene ejecución controlada con IDs fijos y
  `social-publication-e2e.ts` contiene simulaciones. Ninguno es un flujo genérico
  apropiado para conectarlo a las variantes del workspace.

El incremento mínimo es explicar la brecha entre programación editorial y operación
del runtime a partir de los contratos ya leídos. No reconstruye aprobación,
programación, comparación ni reconciliación y no añade un camino de publicación.

## Comportamiento

Debajo de la comparación aparece «Siguiente paso operativo», limitado a la variante
actual. Evalúa canal, aprobación de contenido, enlace publicación/programación/variante,
aprobación separada de programación, fecha alcanzada, primera referencia de media
e historial de intentos. Fechas inválidas y enlaces inconsistentes quedan pendientes.

Cada intento conserva su ID y estado y recibe orientación: pendiente no se duplica,
en progreso requiere seguimiento sin reintento, fallo o cancelación no autorizan
otro intento. Se conservan todos los intentos, incluido un éxito anterior a un fallo.
Una referencia `local-*` o ausente no acredita publicación externa. Una referencia
externa se describe como éxito reportado por el runtime, sin verificar al proveedor.

Los IDs de publicación, campaña, contenido, variante, programación y primera media
quedan visibles para seguimiento. No se generan nuevas identidades ni evidencia durable.
El diagnóstico es una función pura sobre el snapshot existente y el reloj de la página.
No hace lecturas nuevas, escrituras, simulaciones ni llamadas a proveedores.

Incluso con todos los requisitos observables cumplidos, `executionAllowed` permanece
`false`. El panel advierte que la biblioteca puede estar desactualizada o incompleta
y que autorización de media, configuración y estado actual del servidor no están
verificados. No es un preflight autoritativo del servidor ni sustituye sus guardas.

## Gobernanza

GENERATED != OFFICIAL; RECOMMENDATION != EXECUTION. La aprobación humana y la
programación siguen siendo decisiones explícitas e independientes. TikTok y Reel
continúan con integración pendiente; WhatsApp SEND bloqueado. Sin scheduler automático,
Meta calls, publicación externa, PROD, mutaciones Supabase, migraciones ni deploy.
Sin commit, push o merge. No se necesita operación remota para este incremento local.

## Validación local

- Suite focalizada de workspace, comparación, diagnóstico y marketing: 12 archivos,
  122 tests aprobados.
- Suite completa: 230 archivos, 1236 tests aprobados.
- Lint completo: aprobado.
- Typecheck recursivo completo: aprobado.
- Build recursivo completo: aprobado; Vite advierte de un chunk mayor de 500 kB
  en Control Center, sin fallo de compilación.
- Diff-check y formato de archivos del incremento: aprobados.
- Las pruebas nuevas recorren revisión → aprobación → programación usando los
  handlers existentes, vencimiento exacto y futuro, canales no disponibles, vínculos
  inconsistentes, cancelaciones, fechas inválidas, primera media, estados de intentos,
  simulación, asociación ajena y renderizado con trazabilidad sin controles de ejecución.
- Validación de UI mediante renderizado estático; no se probó una sesión autenticada
  contra DEV ni se afirma validación remota.

Nota de entorno: `pnpm typecheck` invocado desde el script encontró un pnpm global
11.22.0 incompatible con el 10.15.0 fijado. Los gates recursivos se ejecutan directamente
con `corepack pnpm -r --if-present ...`, sin modificar manifiestos ni lockfile.
