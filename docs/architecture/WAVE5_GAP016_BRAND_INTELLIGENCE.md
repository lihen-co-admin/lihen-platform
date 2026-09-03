# LIHEN WAVE 5 — GAP-016
## Brand Intelligence — REUSE + EXTEND / CONSOLIDATE V1

**Recovery point de entrada:** `b39173380e97b82b6c708677794e335fe42c1ad5`
**GAP:** GAP-016 — Brand Intelligence
**Roadmap action original:** BUILD
**Acción real después de auditoría:** REUSE + EXTEND / CONSOLIDATE
**DB migration V1:** 0
**RLS V1:** 0
**RPC V1:** 0
**UI V1:** 0
**PROD:** 0

## Auditoría real

GAP-016 no parte de cero.

### Foundation de dominio
GAP-015 formalizó `BrandAsset` / `BrandAssetSet` con:
- LOGO / WORDMARK / ISOTYPE / LOCKUP;
- MANUAL_VERIFIED / AUTO_VERIFIED / CANDIDATE / REQUIRES_REVIEW;
- protección conceptual del manual verified;
- Brand Asset 1:N sin persistencia paralela.

`public.brands.logo_url` continúa como compatibilidad histórica del Brand Master.

### Intelligence Core
`@lihen/intelligence-core` ya contiene:
- context `BRAND`;
- capability `BRAND_INTELLIGENCE`;
- `IntelligenceEvidence`;
- `IntelligenceCandidate` con `BRAND_IDENTITY` y `BRAND_ASSET`;
- `IntelligenceRecommendation`;
- Source Authority + Confidence;
- Permission Model;
- Assurance;
- Orchestrator;
- SearchPort;
- VisionPort;
- Review Queue;
- Existing Control Plane handoff.

Por tanto, GAP-016 no crea un segundo Core, segundo Orchestrator, segunda Review Queue
ni segundo Command Engine.

### Supabase DEV
La auditoría read-only confirmó `lihen_private.brand_intelligence_sources`.

La tabla física actual es legacy/name-based:
- brand_name;
- source_url;
- source_role;
- trust_tier;
- media_rights_basis;
- status;
- notes.

Restricciones existentes:
- source_role: OFFICIAL_BRAND / OFFICIAL_PRODUCT_COLLECTION /
  AUTHORIZED_SUPPLIER / SECONDARY_REFERENCE;
- trust_tier: TIER_1 / TIER_2 / TIER_3;
- media_rights_basis: PUBLIC_REFERENCE_ONLY /
  USER_CONFIRMED_SUPPLIER_RIGHTS / BRAND_AUTHORIZED / INTERNAL_LIHEN_ASSET;
- status: ACTIVE / INACTIVE;
- unique `(brand_name, source_url)`.

Al momento de la auditoría la tabla contiene 0 registros.

También existen `visual_intelligence_sessions`, `visual_intelligence_signals`,
`visual_intelligence_candidates` y `visual_intelligence_decisions`. Esta foundation
es rica en signals, source role, verification, rights, similarity, confidence y
human decision, pero su workflow físico actual es principalmente product-oriented
(por ejemplo session/product relationship y vocabulario de candidate identity).
No se fuerza Brand Intelligence dentro de esas tablas sin una consolidación física
posterior expresamente diseñada.

Verificación adicional importante: en el esquema DEV actual no existen RPCs con
nombre `brand_intelligence_*`. Sí existen funciones controladas de Visual Intelligence.
Por tanto no se documentan RPCs Brand Intelligence históricos como estado actual.

## Decisión

GAP-016 = REUSE + EXTEND / CONSOLIDATE.

V1 agrega una capability pura dentro de la foundation Intelligence existente para
convertir evidencia de Brand en:

`Source Authority → Evidence → Brand Asset Candidate → Recommendation → Human Review`

No implementa búsqueda web concreta ni análisis Vision concreto. Reutiliza
`SearchPort` y `VisionPort` como contratos obligatorios para futuros adapters.

## Reglas V1

1. La identidad canónica continúa perteneciendo a Brand Master + Brand Assets.
2. Intelligence prepara evidencia/candidatos/recomendaciones; no muta Brand Master.
3. Una fuente OFFICIAL_BRAND TIER_1/TIER_2 puede alcanzar autoridad OFFICIAL.
4. Fuentes secundarias o débiles no se elevan silenciosamente a identidad oficial.
5. Confidence es calidad de evidencia, nunca autorización.
6. Un candidato de fuente oficial, BRAND_AUTHORIZED y confidence >= 0.85 puede ser
   `VERIFICATION_ELIGIBLE`, pero la mutación canónica sigue siendo R3 y requiere review.
7. Un ACTIVE primary MANUAL_VERIFIED del mismo kind queda protegido.
8. Un candidato distinto no puede reemplazar silenciosamente ese manual verified.
9. Si el candidato coincide con la misma URL manual verified, no se propone reemplazo.
10. Fuentes INACTIVE se rechazan como soporte de candidato canónico.
11. `PUBLIC_REFERENCE_ONLY` permanece en revisión aunque la fuente sea oficial.
12. Todos los artefactos preparados conservan el mismo correlationId.
13. No SQL, RPC, Supabase, UI, renderer, publishing ni PROD.

## Separación con GAP-017

GAP-017 conserva Brand Workspace `/brands`.

GAP-016 no construye:
- panel de marcas;
- candidate browser;
- botones aprobar/rechazar;
- upload de logos;
- persistencia Brand Assets;
- renderer/catalog integration.

## DoD V1

- source authority policy explícita;
- Evidence → Candidate → Recommendation;
- manual verified protection;
- R3/human review para cambio canónico;
- provider-neutral Search/Vision boundary;
- unit tests;
- architecture tests;
- `pnpm test:architecture` PASS;
- `pnpm check` PASS;
- exact staging;
- commit/push verificados;
- continuidad actualizada.
