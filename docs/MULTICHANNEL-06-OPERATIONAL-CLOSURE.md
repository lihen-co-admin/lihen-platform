# MULTICHANNEL-06 — Governed Operational Closure

Base local autoritativa: HEAD y `origin/next-phase` coinciden en
`f693ab92eded889be7dde7d2f02f0a0655871f0d`. Sin fetch, commit, push ni merge.

## Gaps reales y cierre local

- El workspace persistía, revisaba y programaba; solo ofrecía diagnóstico local.
  Ahora conecta evaluación fresca, confirmación de creación de PENDING,
  nueva evaluación, confirmación independiente de ejecución y relectura del resultado.
- Se retiró `social-dev-runtime.ts`: no tenía consumidores y conservaba una
  ejecución con IDs fijos y una creación que ya no cumple el contrato de confirmación.
- Se reutiliza `marketing-social-runtime` y sus RPC CREATE/START/COMPLETE existentes.
  No se introduce otro publicador, adapter, scheduler, tabla ni migración.
- La lectura operativa consulta la publicación seleccionada y su historial,
  independientemente de los límites de la biblioteca. Un historial de 1000 intentos
  se rechaza explícitamente para no convertir truncamiento en ausencia.
- El producto se deriva exclusivamente de la primera media, como exige el runtime.
  Un SUCCEEDED sin referencia no se etiqueta como publicado.

## Contrato y gobernanza

`ASSESS_PUBLICATION_OPERATION` es read-only y está detrás de autenticación,
perfil ACTIVE OWNER/ADMIN y `MARKETING_SOCIAL_ENVIRONMENT=DEV` en servidor.
Valida canal, aprobación, vínculo de variante/programación, fecha, primera imagen
autorizada por `get_product_images`, historial y, para ejecución, configuración Meta.
No llama a Meta. Devuelve bloqueos, próxima acción posible y digest SHA-256
de contenido persistido, programación, intentos, producto y URL autorizada.
`executionAllowed=false`: un assessment nunca ejecuta ni equivale a aprobación.

CREATE y EXECUTE requieren `confirmedAction` y `expectedSnapshot` coincidentes
con una nueva lectura del servidor. La UI muestra el contenido, CTA, hashtags,
media, canal e identidad evaluados y pide confirmación sin preseleccionar.
Consume la confirmación tras una sola solicitud. No hay ejecución en effects,
generación, planificación, selección ni vencimiento de fechas.

CREATE usa una identidad determinista por publicación y clave de operación estable
con el RPC existente. Las solicitudes concurrentes no crean dos intentos. No acepta
crear otro si existe cualquier intento. EXECUTE admite únicamente un PENDING único;
FAILED, CANCELLED, SUCCEEDED, IN_PROGRESS y múltiples intentos bloquean el flujo.
START recibe una clave nueva creada en servidor por invocación: su transición
atómica PENDING → IN_PROGRESS determina el único solicitante que llega al proveedor;
una respuesta idempotente antigua no se reutiliza para publicar otra vez.
Se reevalúa el snapshot antes de START y se usa el contenido confirmado.

La UI relee la variante tras éxito o error y conserva las advertencias de resultado
incierto. La reconciliación aquí es **relectura de persistencia**, no una consulta
al proveedor ni resolución manual de IN_PROGRESS. No inventa resultados externos.
El contrato remoto existente no ofrece resolución durable de reconciliación;
los casos inciertos quedan bloqueados para investigación humana, sin reintento.

GENERATED != OFFICIAL; RECOMMENDATION != EXECUTION.
TikTok/Reel no tienen ejecución disponible. WhatsApp sigue en Conversation, SEND
bloqueado. No se activó scheduler, no se cambió PROD ni configuración remota.
No se crearon intentos reales ni se llamó a Meta: todos los efectos de pruebas
son dobles locales. No se conectó a Supabase para verificar o mutar datos remotos.

## Archivos

- `apps/control-center/src/pages/SocialContentPage.tsx`
- `apps/control-center/src/components/EditorialOperationalActions.tsx`
- `apps/control-center/src/components/EditorialOperationAssessment.tsx`
- `apps/control-center/src/composition/editorial-operations.ts`
- `apps/control-center/src/composition/editorial-workspace.ts`
- `apps/control-center/src/composition/social-dev-runtime.ts` (eliminado)
- `apps/control-center/src/domain/editorial-operation-assessment.ts`
- `apps/control-center/src/domain/editorial-planning.ts`
- `supabase/functions/marketing-social-runtime/index.ts`
- `supabase/functions/marketing-social-runtime/operational-policy.ts`
- `apps/control-center/tests/editorial-operational-closure.test.ts`
- `apps/control-center/tests/editorial-operation-assessment.test.ts`
- `apps/control-center/tests/fixtures/editorial-operations.{html,tsx}`
- `tests/editorial-e2e/editorial-operational-closure.spec.ts`
- `playwright.editorial.config.ts`
- Este documento.

## Validación

- `corepack pnpm test`: **231 archivos / 1255 tests aprobados**, exit 0.
- `corepack pnpm test:architecture`: **60 archivos / 327 tests aprobados**, exit 0
  (incluidos también en la suite completa).
- `corepack pnpm exec playwright test -c playwright.editorial.config.ts`:
  **1 test aprobado**, exit 0, cero solicitudes externas observadas.
- `corepack pnpm -r --if-present typecheck`: aprobado, exit 0.
- `corepack pnpm lint`: aprobado, exit 0.
- `corepack pnpm -r --if-present build`: aprobado, exit 0. Advertencia de Vite
  por chunk de Control Center de 525.43 kB, superior a 500 kB.
- Formato de los 16 archivos existentes/nuevos del incremento: aprobado.
  Formato global: **exit 1**, quedan **1167 archivos no modificados** con deuda
  previa; ninguno coincide con los archivos modificados o nuevos. No se aplicó
  un reformateo masivo ajeno al objetivo.
- `git diff --check`: aprobado, exit 0.

Una ejecución concurrente de gates produjo timeout durante la transformación
inicial del test del runtime. Se movió esa transformación fuera de los casos
para reutilizarla; la suite completa final pasó sin aumentar timeouts.

La prueba de endpoint ejecuta el handler real con auth, RPC y fetch sustituidos:
no crea clientes reales ni transportes externos. El E2E de navegador usa una
fixture fuera del entrypoint de la aplicación y aborta solicitudes externas.
No se afirma haber ejecutado un E2E autenticado contra Supabase DEV ni typecheck
de Deno (Deno no está instalado); el handler se transpila y ejecuta en los tests.

## Pendiente exclusivamente remoto

Desplegar en el proyecto **DEV** la función `marketing-social-runtime` junto con
`operational-policy.ts`, configurar `MARKETING_SOCIAL_ENVIRONMENT=DEV` y mantener
`META_PUBLICATION_ENABLED=false`. Verificar allí con OWNER/ADMIN la persistencia,
assessment y relectura usando las migraciones/RPC ya existentes, sin activar
scheduler ni hacer llamadas a Meta. No se requiere nueva migración local.

Una publicación externa E2E no se ejecuta como validación de este incremento:
necesita una autorización futura explícita para esa publicación, configuración
del proveedor y confirmaciones del operador. La preparación local no la autoriza.

READY_FOR_SUPABASE: desplegar en DEV marketing-social-runtime con operational-policy.ts; configurar MARKETING_SOCIAL_ENVIRONMENT=DEV y mantener META_PUBLICATION_ENABLED=false; verificar persistencia, assessment y relectura con OWNER/ADMIN, sin ejecución Meta ni scheduler.
