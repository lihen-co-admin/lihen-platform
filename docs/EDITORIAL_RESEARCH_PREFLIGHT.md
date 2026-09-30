# EDITORIAL_RESEARCH_PREFLIGHT

Base verified after fetch: `4ed6f2a22af919d88cc028f82186ef81a045def4` (`origin/next-phase`).

## HTTP contract

POST to the existing `intelligence-runtime` endpoint with a Bearer token and JSON:

```json
{ "action": "EDITORIAL_RESEARCH_PREFLIGHT" }
```

Requires the existing authenticated user lookup and an ACTIVE persisted OWNER/ADMIN profile. No productId is required. Client-supplied configuration is ignored. Existing authentication/authorization failures retain their 401/403 responses (lookup/configuration failures retain existing runtime error responses).

A successful assessment returns HTTP 200, including when readiness is false:

```json
{
  "runtime": "LIHEN_INTELLIGENCE",
  "action": "EDITORIAL_RESEARCH_PREFLIGHT",
  "readiness": {
    "featureEnabled": false,
    "providerConfigured": false,
    "allowlistConfigured": false,
    "authorityRegistryConfigured": false,
    "freeOnlyConfigured": false,
    "dependenciesConfigured": false,
    "readyForActivation": false,
    "reasons": [
      "FEATURE_DISABLED",
      "PROVIDER_NOT_CONFIGURED",
      "ALLOWLIST_NOT_CONFIGURED",
      "AUTHORITY_REGISTRY_NOT_CONFIGURED",
      "FREE_ONLY_NOT_CONFIGURED"
    ]
  }
}
```

The reasons above are the complete enum, in stable check order, with passing checks omitted. All other readiness fields are booleans.

- `featureEnabled`: the server flag is explicitly true; absent/false remains disabled.
- `providerConfigured`: the configured Groq key is nonblank; no credential/provider health probe.
- `allowlistConfigured`: at least one DNS domain, with every normalized entry syntactically valid; URLs, wildcard entries and blank entries fail the pure evaluator.
- `authorityRegistryConfigured`: the existing fail-closed authority parser accepts a nonempty registry and every authority domain is explicitly allowlisted. Malformed or duplicate records fail. No clock or live authority verification is performed; the existing research capability retains its time-sensitive, per-source authority checks.
- `freeOnlyConfigured`: nonblank operator evidence reference and parseable verification timestamp. This checks configuration, not external pricing or actual account billing.
- `dependenciesConfigured`: conjunction of provider, allowlist, authority registry and FREE_ONLY checks. No dependencies are constructed.
- `readyForActivation`: conjunction of featureEnabled and dependenciesConfigured. A fully configured but disabled installation reports dependenciesConfigured=true, readyForActivation=false and FEATURE_DISABLED. This is an advisory configuration assessment, never an activation or proof of provider availability.

## Boundaries

`evaluateEditorialResearchReadiness(config)` is synchronous, pure and uses the existing `EditorialResearchSearchConfig` through a type-only import. The shared server config reader is used by both actions; only EDITORIAL_RESEARCH calls the existing dependency factory. Research behavior remains opt-in and unchanged.

The assessment and preflight branch perform zero network calls, construct/execute no SearchPort, and invoke neither Groq, browser search nor Editorial Research. The HTTP envelope still uses existing Supabase authentication/profile reads; those are mocked in offline tests. No claim is made that production authentication is network-free.

The response is an explicit allowlist of booleans and enum reasons, with no API keys, environment values, evidence references, domain lists or authority records. No environment settings, secrets, flags, scheduler, WhatsApp, publication, Meta/TikTok or port 4163 are changed. PROD HOLD; no deployment or merge.

## Certification

- Pure evaluator tests: deterministic results, no mutation, global/injected fetch unused, missing and invalid prerequisites, mandatory FREE_ONLY, disabled default, secret exclusion.
- HTTP runtime tests execute the actual bundled handler with offline auth/profile fixtures and throwing network/SearchPort-construction sentinels; cover OWNER/ADMIN, forbidden roles, inactive/unauthenticated users, ignored client config, enabled/disabled and incomplete server config.
- Coexistence test now checks all 12 actions (the 11 prior actions plus preflight), preserving ordering and opt-in behavior.
- Consolidated gate: typecheck, lint, complete unit/runtime/architecture suite and build. Edge core bundle check is also required.
- Windows tooling: use pnpm 10.15.0 via Corepack. Bundle byte comparison requires LF locally; the initial CRLF-only mismatch has identical normalized content and introduces no committed bundle change.
