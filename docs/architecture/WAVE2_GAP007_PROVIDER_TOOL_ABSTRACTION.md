# LIHEN WAVE 2 — GAP-007
## Provider & Tool Abstraction V1

**Base exacta:** `ca31db8233997ae1e62577410037671a8a5c1e39`  
**GAP:** GAP-007 — Provider & Tool Abstraction  
**Acción:** BUILD sobre Intelligence Core existente  
**Migraciones Supabase:** 0  
**Cambios RLS:** 0  
**Cambios UI:** 0  
**Cambios PROD:** 0  

## Objetivo

Cerrar WAVE 2 con contratos neutrales para las dependencias externas de Intelligence:

- ModelPort
- VisionPort
- SearchPort
- DocumentExtractionPort
- ImageGenerationPort
- EmbeddingPort

Los contratos describen qué necesita LIHEN. No congelan qué proveedor lo suministra.

## Reutilización

La estructura sigue el patrón de ports ya presente en los packages de dominio de LIHEN.
No se crean adapters concretos en este GAP.

GAP-003 aporta ToolDescriptor, Context y Correlation.
GAP-004 sigue resolviendo Permission.
GAP-005 sigue resolviendo Assurance.
GAP-006 sigue coordinando capabilities.

GAP-007 únicamente establece la frontera capability → port → futura infrastructure adapter.

## ProviderResult

Todos los ports comparten resultado neutral:

- status;
- data opcional;
- messages;
- trace opcional.

ProviderTrace puede conservar providerRef, model/engine, requestRef, duration y usage/cost
estimado. Estos datos son observabilidad técnica; no son Evidence de negocio por sí solos.

## Generation provenance

ImageGenerationPort obliga a que el resultado declare provenance `GENERATED`.

Una imagen generada:
- no es OFFICIAL;
- no reemplaza automáticamente Product Asset o Brand Asset;
- no se publica automáticamente;
- deberá entrar a políticas/review posteriores.

## No acoplamiento prematuro

No se incorporan:
- SDKs;
- API keys;
- HTTP clients;
- OpenAI/Google/Anthropic/AWS/etc.;
- selección de proveedor;
- fallback/retry real;
- rate-limit infrastructure;
- persistence;
- SQL/RPC;
- UI.

GAP-041/GAP-042 completarán retry/correlation/observability transversal cuando corresponda.

## Relación con GAP-006

`IntelligenceCapabilityHandler` es una frontera interna del Orchestrator.

Los Ports de GAP-007 son dependencias externas de capabilities/adapters futuros.

No se fusionan ambos conceptos.

## Future Marketing / Social

SocialPublishingPort NO se implementa como Intelligence Provider Port.

Una futura publicación social es una operación gobernada de dominio/aplicación que deberá
terminar en el Existing Control Plane/adaptador externo autorizado, no una herramienta que
Intelligence pueda invocar libremente.

## Definition of Done

- seis ports definidos;
- provider-neutral;
- no vendor SDK;
- no SQL/RPC;
- no mutation;
- generated provenance protegido;
- architecture tests PASS;
- unit tests PASS;
- Typecheck PASS;
- Lint PASS;
- Build PASS;
- full pnpm check PASS.
