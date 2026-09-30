// packages/intelligence-adapters/src/document-extraction/gemini-document-extraction-adapter.ts
var GEMINI_DOCUMENT_EXTRACTION_PROVIDER_ID = "GEMINI_3_6_FLASH";
var GEMINI_DOCUMENT_EXTRACTION_MODEL = "gemini-3.6-flash";
var GEMINI_DOCUMENT_EXTRACTION_ROLE = "PRIMARY";
var GEMINI_RAW_EVIDENCE_INSTRUCTION = [
  "Extract only text visibly present in the supplied document image.",
  "Return JSON only.",
  "Return visibleProductText as string or null.",
  "Return visibleBrandText as string or null.",
  "Return visiblePrices as an array of {label, rawText}.",
  "Preserve price strings exactly as visible.",
  "Do not convert prices to numbers.",
  "Do not interpret Colombian thousands or decimal separators.",
  "Do not canonicalize product identity.",
  "Do not invent non-visible fields."
].join(" ");
function isNullableString(value) {
  return value === null || typeof value === "string";
}
function parseVisibleEvidence(bodyText) {
  let parsed;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed;
  if (!isNullableString(
    record.visibleProductText
  ) || !isNullableString(
    record.visibleBrandText
  ) || !Array.isArray(record.visiblePrices) || !Array.isArray(record.warnings)) {
    return null;
  }
  const visiblePrices = [];
  for (const value of record.visiblePrices) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const price = value;
    if (!isNullableString(price.label) || typeof price.rawText !== "string") {
      return null;
    }
    visiblePrices.push({
      label: price.label,
      rawText: price.rawText
    });
  }
  const warnings = [];
  for (const warning of record.warnings) {
    if (typeof warning !== "string") {
      return null;
    }
    warnings.push(warning);
  }
  return {
    visibleProductText: record.visibleProductText,
    visibleBrandText: record.visibleBrandText,
    visiblePrices,
    warnings
  };
}
var GeminiDocumentExtractionAdapter = class {
  constructor(transport) {
    this.transport = transport;
  }
  transport;
  providerId = GEMINI_DOCUMENT_EXTRACTION_PROVIDER_ID;
  model = GEMINI_DOCUMENT_EXTRACTION_MODEL;
  role = GEMINI_DOCUMENT_EXTRACTION_ROLE;
  async extract(input) {
    const transportResult = await this.transport.execute({
      model: GEMINI_DOCUMENT_EXTRACTION_MODEL,
      requestId: input.requestId,
      mimeType: input.mimeType,
      contentBase64: input.contentBase64,
      instruction: GEMINI_RAW_EVIDENCE_INSTRUCTION
    });
    if (!transportResult.ok) {
      return {
        ok: false,
        failure: transportResult.failure,
        trace: {
          provider: GEMINI_DOCUMENT_EXTRACTION_PROVIDER_ID,
          model: GEMINI_DOCUMENT_EXTRACTION_MODEL,
          role: GEMINI_DOCUMENT_EXTRACTION_ROLE,
          startedAt: transportResult.startedAt,
          completedAt: transportResult.completedAt,
          latencyMs: transportResult.latencyMs,
          structuredOutputValid: null,
          evidenceAuthority: "RAW_VISIBLE_EVIDENCE"
        }
      };
    }
    const extraction = parseVisibleEvidence(
      transportResult.bodyText
    );
    if (!extraction) {
      return {
        ok: false,
        failure: "schema_invalid",
        trace: {
          provider: GEMINI_DOCUMENT_EXTRACTION_PROVIDER_ID,
          model: GEMINI_DOCUMENT_EXTRACTION_MODEL,
          role: GEMINI_DOCUMENT_EXTRACTION_ROLE,
          startedAt: transportResult.startedAt,
          completedAt: transportResult.completedAt,
          latencyMs: transportResult.latencyMs,
          structuredOutputValid: false,
          evidenceAuthority: "RAW_VISIBLE_EVIDENCE"
        }
      };
    }
    return {
      ok: true,
      extraction,
      trace: {
        provider: GEMINI_DOCUMENT_EXTRACTION_PROVIDER_ID,
        model: GEMINI_DOCUMENT_EXTRACTION_MODEL,
        role: GEMINI_DOCUMENT_EXTRACTION_ROLE,
        startedAt: transportResult.startedAt,
        completedAt: transportResult.completedAt,
        latencyMs: transportResult.latencyMs,
        structuredOutputValid: true,
        evidenceAuthority: "RAW_VISIBLE_EVIDENCE"
      }
    };
  }
};

// packages/intelligence-adapters/src/document-extraction/ollama-document-extraction-adapter.ts
var OLLAMA_DOCUMENT_EXTRACTION_PROVIDER_ID = "OLLAMA_QWEN3_VL_4B";
var OLLAMA_DOCUMENT_EXTRACTION_MODEL = "qwen3-vl:4b-instruct";
var OLLAMA_DOCUMENT_EXTRACTION_ROLE = "LOCAL_FALLBACK";
var OLLAMA_RAW_EVIDENCE_INSTRUCTION = [
  "Extract only text visibly present in the supplied document image.",
  "Return JSON only.",
  "Return visibleProductText as string or null.",
  "Return visibleBrandText as string or null.",
  "Return visiblePrices as an array of {label, rawText}.",
  "Return warnings as an array of strings.",
  "Preserve price strings exactly as visible.",
  "Do not convert prices to numbers.",
  "Do not interpret Colombian thousands or decimal separators.",
  "Do not canonicalize product identity.",
  "Do not invent non-visible fields."
].join(" ");
function parseEvidence(bodyText) {
  let parsed;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed;
  if (!(record.visibleProductText === null || typeof record.visibleProductText === "string") || !(record.visibleBrandText === null || typeof record.visibleBrandText === "string") || !Array.isArray(record.visiblePrices) || !Array.isArray(record.warnings)) {
    return null;
  }
  const visiblePrices = [];
  for (const item of record.visiblePrices) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return null;
    }
    const price = item;
    if (!(price.label === null || typeof price.label === "string") || typeof price.rawText !== "string") {
      return null;
    }
    visiblePrices.push({
      label: price.label,
      rawText: price.rawText
    });
  }
  const warnings = [];
  for (const warning of record.warnings) {
    if (typeof warning !== "string") {
      return null;
    }
    warnings.push(warning);
  }
  return {
    visibleProductText: record.visibleProductText,
    visibleBrandText: record.visibleBrandText,
    visiblePrices,
    warnings
  };
}
var OllamaDocumentExtractionAdapter = class {
  constructor(transport) {
    this.transport = transport;
  }
  transport;
  providerId = OLLAMA_DOCUMENT_EXTRACTION_PROVIDER_ID;
  model = OLLAMA_DOCUMENT_EXTRACTION_MODEL;
  role = OLLAMA_DOCUMENT_EXTRACTION_ROLE;
  async extract(input) {
    const result = await this.transport.execute({
      model: this.model,
      requestId: input.requestId,
      mimeType: input.mimeType,
      contentBase64: input.contentBase64,
      instruction: OLLAMA_RAW_EVIDENCE_INSTRUCTION
    });
    if (!result.ok) {
      return {
        ok: false,
        failure: result.failure,
        trace: {
          provider: this.providerId,
          model: this.model,
          role: this.role,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
          latencyMs: result.latencyMs,
          structuredOutputValid: null,
          evidenceAuthority: "RAW_VISIBLE_EVIDENCE"
        }
      };
    }
    const extraction = parseEvidence(result.bodyText);
    if (!extraction) {
      return {
        ok: false,
        failure: "schema_invalid",
        trace: {
          provider: this.providerId,
          model: this.model,
          role: this.role,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
          latencyMs: result.latencyMs,
          structuredOutputValid: false,
          evidenceAuthority: "RAW_VISIBLE_EVIDENCE"
        }
      };
    }
    return {
      ok: true,
      extraction,
      trace: {
        provider: this.providerId,
        model: this.model,
        role: this.role,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        latencyMs: result.latencyMs,
        structuredOutputValid: true,
        evidenceAuthority: "RAW_VISIBLE_EVIDENCE"
      }
    };
  }
};

// packages/intelligence-adapters/src/document-extraction/document-content-resolver.ts
function requiredText(value, code) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(code);
  }
  return normalized;
}
function validateBase64(value) {
  const normalized = requiredText(
    value,
    "DOCUMENT_CONTENT_BASE64_REQUIRED"
  );
  if (normalized.startsWith("data:") || /\s/.test(normalized) || !/^[A-Za-z0-9+/]*={0,2}$/.test(
    normalized
  ) || normalized.length % 4 !== 0) {
    throw new Error(
      "DOCUMENT_CONTENT_BASE64_INVALID"
    );
  }
  return normalized;
}
function validatePageRange(range) {
  if (!range) {
    return void 0;
  }
  if (!Number.isInteger(range.from) || !Number.isInteger(range.to) || range.from < 1 || range.to < range.from) {
    throw new Error(
      "DOCUMENT_CONTENT_PAGE_RANGE_INVALID"
    );
  }
  return {
    from: range.from,
    to: range.to
  };
}
function validateResolvedDocumentContent(document, resolved) {
  const expectedDocumentRef = requiredText(
    document.documentRef,
    "DOCUMENT_CONTENT_DOCUMENT_REF_REQUIRED"
  );
  const resolvedDocumentRef = requiredText(
    resolved.documentRef,
    "DOCUMENT_CONTENT_RESOLVED_DOCUMENT_REF_REQUIRED"
  );
  if (resolvedDocumentRef !== expectedDocumentRef) {
    throw new Error(
      "DOCUMENT_CONTENT_DOCUMENT_REF_MISMATCH"
    );
  }
  if (!Array.isArray(resolved.parts) || resolved.parts.length === 0) {
    throw new Error(
      "DOCUMENT_CONTENT_PARTS_REQUIRED"
    );
  }
  const seenPartRefs = /* @__PURE__ */ new Set();
  let previousPageEnd = null;
  const parts = resolved.parts.map(
    (part, index) => {
      const partRef = requiredText(
        part.partRef,
        "DOCUMENT_CONTENT_PART_REF_REQUIRED"
      );
      if (seenPartRefs.has(partRef)) {
        throw new Error(
          "DOCUMENT_CONTENT_PART_REF_DUPLICATE"
        );
      }
      seenPartRefs.add(partRef);
      const mimeType = requiredText(
        part.mimeType,
        "DOCUMENT_CONTENT_MIME_TYPE_REQUIRED"
      );
      const contentBase64 = validateBase64(
        part.contentBase64
      );
      const pageRange = validatePageRange(
        part.pageRange
      );
      if (pageRange && previousPageEnd !== null && pageRange.from !== previousPageEnd + 1) {
        throw new Error(
          "DOCUMENT_CONTENT_PAGE_COVERAGE_NON_CONTIGUOUS"
        );
      }
      if (pageRange) {
        previousPageEnd = pageRange.to;
      }
      if (!pageRange && previousPageEnd !== null) {
        throw new Error(
          "DOCUMENT_CONTENT_PAGE_RANGE_MIXED"
        );
      }
      return {
        partRef,
        mimeType,
        contentBase64,
        ...pageRange ? { pageRange } : {},
        ...part.sourceUri ? {
          sourceUri: part.sourceUri
        } : {},
        _index: index
      };
    }
  );
  const hasPageRanges = parts.some(
    (part) => part.pageRange !== void 0
  );
  if (hasPageRanges && parts.some(
    (part) => part.pageRange === void 0
  )) {
    throw new Error(
      "DOCUMENT_CONTENT_PAGE_RANGE_MIXED"
    );
  }
  return {
    documentRef: resolvedDocumentRef,
    ...resolved.sourceUri ? {
      sourceUri: resolved.sourceUri
    } : {},
    ...resolved.fingerprint ? {
      fingerprint: resolved.fingerprint
    } : {},
    parts: parts.map(
      ({
        _index: _ignored,
        ...part
      }) => part
    )
  };
}
async function prepareDocumentExtractionUnits(input) {
  const requestId = requiredText(
    input.requestId,
    "DOCUMENT_EXTRACTION_REQUEST_ID_REQUIRED"
  );
  const resolved = validateResolvedDocumentContent(
    input.document,
    await input.resolver.resolve(
      input.document
    )
  );
  return resolved.parts.map(
    (part, index) => ({
      documentRef: resolved.documentRef,
      partRef: part.partRef,
      adapterInput: {
        requestId: resolved.parts.length === 1 ? requestId : `${requestId}:part:${String(
          index + 1
        ).padStart(4, "0")}`,
        sourceDocumentId: resolved.documentRef,
        mimeType: part.mimeType,
        contentBase64: part.contentBase64
      },
      ...part.pageRange ? {
        pageRange: part.pageRange
      } : {},
      ...part.sourceUri ? {
        sourceUri: part.sourceUri
      } : {}
    })
  );
}

// packages/intelligence-core/src/document-extraction-provider-trace.ts
function createDocumentExtractionAttemptTrace(input) {
  return {
    ...input,
    freeOnly: true,
    evidenceAuthority: "RAW_VISIBLE_EVIDENCE"
  };
}

// packages/intelligence-core/src/document-extraction-orchestrator-state-machine.ts
var INITIAL_DOCUMENT_EXTRACTION_ORCHESTRATOR_STATE = {
  status: "IDLE",
  attempts: [],
  selectedAttemptId: null,
  humanReviewReason: null,
  holdReason: null,
  retrySameProviderAllowed: false,
  automaticGroqChainingAllowed: false,
  semanticProviderShoppingAllowed: false
};
function appendAttempt(state, attempt) {
  return [...state.attempts, attempt];
}
function assertProviderRole(attempt, expected) {
  if (attempt.role !== expected) {
    throw new Error(
      `Expected ${expected} attempt but received ${attempt.role}`
    );
  }
}
function transitionDocumentExtractionOrchestrator(state, event) {
  if (state.status === "SUCCESS" || state.status === "HUMAN_REVIEW" || state.status === "HOLD") {
    throw new Error(
      `Terminal state ${state.status} cannot transition`
    );
  }
  if (state.status === "IDLE") {
    if (event.type !== "START") {
      throw new Error(
        "IDLE accepts only START"
      );
    }
    return {
      ...state,
      status: "PRIMARY_PENDING"
    };
  }
  if (state.status === "PRIMARY_PENDING") {
    if (event.type === "PRIMARY_SUCCESS") {
      assertProviderRole(
        event.attempt,
        "PRIMARY"
      );
      return {
        ...state,
        status: "SUCCESS",
        attempts: appendAttempt(
          state,
          event.attempt
        ),
        selectedAttemptId: event.attempt.attemptId
      };
    }
    if (event.type === "PRIMARY_TECHNICAL_FAILURE") {
      assertProviderRole(
        event.attempt,
        "PRIMARY"
      );
      if (event.reason === "policy_violation") {
        return {
          ...state,
          status: "HOLD",
          attempts: appendAttempt(
            state,
            event.attempt
          ),
          holdReason: event.reason
        };
      }
      return {
        ...state,
        status: "LOCAL_FALLBACK_PENDING",
        attempts: appendAttempt(
          state,
          event.attempt
        )
      };
    }
    if (event.type === "PRIMARY_REVIEW_REQUIRED") {
      assertProviderRole(
        event.attempt,
        "PRIMARY"
      );
      return {
        ...state,
        status: "HUMAN_REVIEW",
        attempts: appendAttempt(
          state,
          event.attempt
        ),
        humanReviewReason: event.reason
      };
    }
    throw new Error(
      `Invalid event ${event.type} for PRIMARY_PENDING`
    );
  }
  if (state.status === "LOCAL_FALLBACK_PENDING") {
    if (event.type === "LOCAL_SUCCESS") {
      assertProviderRole(
        event.attempt,
        "LOCAL_FALLBACK"
      );
      return {
        ...state,
        status: "SUCCESS",
        attempts: appendAttempt(
          state,
          event.attempt
        ),
        selectedAttemptId: event.attempt.attemptId
      };
    }
    if (event.type === "LOCAL_TECHNICAL_FAILURE") {
      assertProviderRole(
        event.attempt,
        "LOCAL_FALLBACK"
      );
      return {
        ...state,
        status: "HOLD",
        attempts: appendAttempt(
          state,
          event.attempt
        ),
        holdReason: event.reason
      };
    }
    if (event.type === "LOCAL_REVIEW_REQUIRED") {
      assertProviderRole(
        event.attempt,
        "LOCAL_FALLBACK"
      );
      return {
        ...state,
        status: "HUMAN_REVIEW",
        attempts: appendAttempt(
          state,
          event.attempt
        ),
        humanReviewReason: event.reason
      };
    }
    throw new Error(
      `Invalid event ${event.type} for LOCAL_FALLBACK_PENDING`
    );
  }
  throw new Error(
    `Unhandled orchestrator state ${state.status}`
  );
}

// packages/intelligence-adapters/src/document-extraction/document-extraction-canonical-bridge.ts
var PRICE_LABEL_SEMANTICS_UNRESOLVED = "PRICE_LABEL_SEMANTICS_UNRESOLVED";
function compactText(value) {
  if (value === null) {
    return null;
  }
  const normalized = value.trim();
  return normalized || null;
}
function parseVisibleCopAmount(rawText) {
  const text = rawText.trim();
  const match = text.match(
    /\$\s*([0-9]{1,3}(?:\.[0-9]{3})*|[0-9]+)(?![0-9.,])/
  );
  if (!match) {
    return null;
  }
  const numeric = match[1];
  if (!numeric) {
    return null;
  }
  const normalized = numeric.replace(/\./g, "");
  if (!/^\d+$/.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value < 0) {
    return null;
  }
  return value;
}
function normalizeVisiblePrice(price) {
  return {
    label: compactText(price.label),
    rawText: price.rawText,
    amountCop: parseVisibleCopAmount(
      price.rawText
    )
  };
}
function adapterTraceToProviderTrace(result) {
  return {
    providerRef: result.trace.provider,
    modelOrEngine: result.trace.model,
    durationMs: result.trace.latencyMs ?? void 0
  };
}
function failureStatus(failure) {
  switch (failure) {
    case "rate_limited":
      return "RATE_LIMITED";
    case "provider_unavailable":
      return "UNAVAILABLE";
    case "timeout":
    case "transport_failure":
    case "schema_invalid":
    case "billing_required":
    case "access_denied":
    case "authentication_invalid":
    case "policy_violation":
      return "FAILED";
  }
}
function failureMessage(failure) {
  return `DOCUMENT_EXTRACTION_${failure.toUpperCase()}`;
}
function visiblePricesFor(evidence) {
  return evidence.visiblePrices.map(
    normalizeVisiblePrice
  );
}
function bridgeDocumentExtractionResult(input) {
  const trace = adapterTraceToProviderTrace(
    input.adapterResult
  );
  if (!input.adapterResult.ok) {
    return {
      status: failureStatus(
        input.adapterResult.failure
      ),
      messages: [
        failureMessage(
          input.adapterResult.failure
        )
      ],
      trace
    };
  }
  const evidence = input.adapterResult.extraction;
  const prices = visiblePricesFor(evidence);
  const unresolvedPriceSemantics = prices.length > 0;
  const unparseablePrice = prices.some(
    (price) => price.amountCop === null
  );
  const warnings = [
    ...evidence.warnings,
    ...unresolvedPriceSemantics ? [
      PRICE_LABEL_SEMANTICS_UNRESOLVED
    ] : [],
    ...unparseablePrice ? [
      "VISIBLE_COP_PRICE_PARSE_FAILED"
    ] : []
  ];
  const record = {
    sourceRowKey: input.sourceRowKey,
    sourcePage: input.sourcePage ?? null,
    sourceSlot: null,
    rawText: null,
    supplierReference: null,
    productName: compactText(
      evidence.visibleProductText
    ),
    brandText: compactText(
      evidence.visibleBrandText
    ),
    categoryText: null,
    subcategoryText: null,
    businessLine: null,
    /**
     * Deliberately unresolved.
     *
     * No repository evidence currently proves:
     * MAYOR -> unitCost
     * DETAL -> suggestedSalePrice
     */
    unitCost: null,
    suggestedSalePrice: null,
    quantityHint: null,
    imageReference: null,
    /**
     * Provider confidence is not accepted as business truth
     * in this bridge.
     */
    extractionConfidence: null,
    /**
     * Additional raw/deterministic evidence is preserved
     * inside the provider-neutral fields object.
     */
    visiblePrices: prices
  };
  return {
    status: warnings.length > 0 ? "PARTIAL" : "SUCCESS",
    data: {
      documentRef: input.documentRef,
      fields: {
        records: [record],
        evidencePolicy: {
          providerOutput: "RAW_VISIBLE_EVIDENCE",
          priceNormalization: "DETERMINISTIC_ES_CO",
          priceLabelSemantics: "UNRESOLVED",
          aiDeterminesCopSeparatorSemantics: false
        }
      },
      pages: input.sourcePage === void 0 || input.sourcePage === null ? [] : [input.sourcePage],
      warnings
    },
    messages: warnings,
    trace
  };
}

// packages/intelligence-adapters/src/document-extraction/document-extraction-composition.ts
async function executeDocumentExtractionUnit(input) {
  let state = transitionDocumentExtractionOrchestrator(
    INITIAL_DOCUMENT_EXTRACTION_ORCHESTRATOR_STATE,
    { type: "START" }
  );
  const primaryResult = await input.primary.extract(input.adapterInput);
  const primaryAttempt = toAttempt(
    input.adapterInput.requestId,
    primaryResult
  );
  if (!primaryResult.ok) {
    state = transitionDocumentExtractionOrchestrator(
      state,
      {
        type: "PRIMARY_TECHNICAL_FAILURE",
        attempt: primaryAttempt,
        reason: primaryResult.failure
      }
    );
    if (state.status !== "LOCAL_FALLBACK_PENDING") {
      return { state };
    }
    const localResult = await input.localFallback.extract(input.adapterInput);
    const localAttempt = toAttempt(
      `${input.adapterInput.requestId}:local`,
      localResult
    );
    if (!localResult.ok) {
      state = transitionDocumentExtractionOrchestrator(
        state,
        {
          type: "LOCAL_TECHNICAL_FAILURE",
          attempt: localAttempt,
          reason: localResult.failure
        }
      );
      return { state };
    }
    const canonical2 = bridgeDocumentExtractionResult({
      documentRef: input.documentRef,
      sourceRowKey: input.sourceRowKey,
      adapterResult: localResult
    });
    const reviewRequired2 = canonical2.data?.warnings.includes(
      PRICE_LABEL_SEMANTICS_UNRESOLVED
    ) ?? false;
    state = transitionDocumentExtractionOrchestrator(
      state,
      reviewRequired2 ? {
        type: "LOCAL_REVIEW_REQUIRED",
        attempt: localAttempt,
        reason: "ambiguous_evidence"
      } : {
        type: "LOCAL_SUCCESS",
        attempt: localAttempt
      }
    );
    return { state, canonical: canonical2 };
  }
  const canonical = bridgeDocumentExtractionResult({
    documentRef: input.documentRef,
    sourceRowKey: input.sourceRowKey,
    adapterResult: primaryResult
  });
  const reviewRequired = canonical.data?.warnings.includes(
    PRICE_LABEL_SEMANTICS_UNRESOLVED
  ) ?? false;
  state = transitionDocumentExtractionOrchestrator(
    state,
    reviewRequired ? {
      type: "PRIMARY_REVIEW_REQUIRED",
      attempt: primaryAttempt,
      reason: "ambiguous_evidence"
    } : {
      type: "PRIMARY_SUCCESS",
      attempt: primaryAttempt
    }
  );
  return { state, canonical };
}
function toAttempt(attemptId, result) {
  return createDocumentExtractionAttemptTrace({
    attemptId,
    provider: result.trace.provider,
    role: result.trace.role,
    outcome: result.ok ? "SUCCESS" : failureOutcome(result.failure),
    startedAt: result.trace.startedAt,
    completedAt: result.trace.completedAt,
    latencyMs: result.trace.latencyMs,
    remote: result.trace.role !== "LOCAL_FALLBACK",
    model: result.trace.model,
    structuredOutputValid: result.trace.structuredOutputValid,
    fallbackReason: result.ok ? null : fallbackReason(result.failure)
  });
}
function failureOutcome(failure) {
  return failure === "policy_violation" ? "POLICY_HOLD" : failure.toUpperCase();
}
function fallbackReason(failure) {
  return failure === "policy_violation" ? null : failure;
}

// packages/intelligence-adapters/src/document-extraction/multipart-document-extraction-aggregator.ts
function requiredText2(value, code) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(code);
  }
  return normalized;
}
function pagesForRange(range) {
  const pages = [];
  for (let page = range.from; page <= range.to; page += 1) {
    pages.push(page);
  }
  return pages;
}
function uniqueStrings(values) {
  return [...new Set(values)];
}
function hardFailureStatus(statuses) {
  if (statuses.length === 0) {
    return "NO_RESULT";
  }
  const unique = new Set(statuses);
  if (unique.size === 1) {
    return statuses[0];
  }
  return "FAILED";
}
function dataRecords(data) {
  const records = data.fields.records;
  if (!Array.isArray(records)) {
    throw new Error(
      "MULTIPART_DOCUMENT_RECORDS_ARRAY_REQUIRED"
    );
  }
  return records.map(
    (record) => {
      if (!record || typeof record !== "object" || Array.isArray(record)) {
        throw new Error(
          "MULTIPART_DOCUMENT_RECORD_INVALID"
        );
      }
      return record;
    }
  );
}
function validateLogicalSourcePage(sourcePage, pageRange) {
  if (sourcePage === null || sourcePage === void 0) {
    return null;
  }
  if (!Number.isInteger(sourcePage) || sourcePage < 1) {
    throw new Error(
      "MULTIPART_SOURCE_PAGE_INVALID"
    );
  }
  const page = sourcePage;
  if (pageRange && (page < pageRange.from || page > pageRange.to)) {
    throw new Error(
      "MULTIPART_SOURCE_PAGE_OUT_OF_RANGE"
    );
  }
  return page;
}
function namespaceRecord(partRef, pageRange, record) {
  const rawKey = typeof record.sourceRowKey === "string" ? record.sourceRowKey.trim() : "";
  if (!rawKey) {
    throw new Error(
      "MULTIPART_SOURCE_ROW_KEY_REQUIRED"
    );
  }
  const sourcePage = validateLogicalSourcePage(
    record.sourcePage,
    pageRange
  );
  return {
    ...record,
    /**
     * Technical namespace only.
     *
     * This prevents collisions between physical parts.
     * It does not change supplier/product semantics.
     */
    sourceRowKey: `${partRef}::${rawKey}`,
    sourcePage
  };
}
function prefixedMessages(partRef, values) {
  return values.map(
    (value) => `PART[${partRef}]:${value}`
  );
}
function aggregateMultipartDocumentExtractions(input) {
  const documentRef = requiredText2(
    input.documentRef,
    "MULTIPART_DOCUMENT_REF_REQUIRED"
  );
  if (!Array.isArray(input.parts) || input.parts.length === 0) {
    throw new Error(
      "MULTIPART_PARTS_REQUIRED"
    );
  }
  const seenPartRefs = /* @__PURE__ */ new Set();
  const mergedRecords = [];
  const mergedPages = /* @__PURE__ */ new Set();
  const warnings = [];
  const messages = [];
  const provenance = [];
  const hardFailures = [];
  let hasPartial = false;
  let usablePartCount = 0;
  for (const part of input.parts) {
    const partRef = requiredText2(
      part.partRef,
      "MULTIPART_PART_REF_REQUIRED"
    );
    if (seenPartRefs.has(partRef)) {
      throw new Error(
        "MULTIPART_PART_REF_DUPLICATE"
      );
    }
    seenPartRefs.add(partRef);
    const data = part.result.data;
    const partWarnings = data?.warnings ?? [];
    provenance.push({
      partRef,
      status: part.result.status,
      pageRange: part.pageRange ?? null,
      messages: [...part.result.messages],
      warnings: [...partWarnings],
      ...part.result.trace ? {
        trace: part.result.trace
      } : {}
    });
    messages.push(
      ...prefixedMessages(
        partRef,
        part.result.messages
      )
    );
    warnings.push(
      ...prefixedMessages(
        partRef,
        partWarnings
      )
    );
    const isHardFailure = part.result.status === "FAILED" || part.result.status === "UNAVAILABLE" || part.result.status === "RATE_LIMITED" || part.result.status === "NO_RESULT";
    if (isHardFailure || !data) {
      const effectiveFailureStatus = isHardFailure ? part.result.status : "NO_RESULT";
      hardFailures.push(
        effectiveFailureStatus
      );
      warnings.push(
        `MULTIPART_PART_FAILED:${partRef}:${effectiveFailureStatus}`
      );
      continue;
    }
    if (data.documentRef !== documentRef) {
      throw new Error(
        "MULTIPART_DOCUMENT_REF_MISMATCH"
      );
    }
    usablePartCount += 1;
    if (part.result.status === "PARTIAL") {
      hasPartial = true;
    }
    for (const record of dataRecords(data)) {
      mergedRecords.push(
        namespaceRecord(
          partRef,
          part.pageRange,
          record
        )
      );
    }
    if (part.pageRange) {
      for (const page of pagesForRange(
        part.pageRange
      )) {
        if (mergedPages.has(page)) {
          throw new Error(
            "MULTIPART_PAGE_DUPLICATION"
          );
        }
        mergedPages.add(page);
      }
    } else {
      for (const page of data.pages) {
        if (!Number.isInteger(page) || page < 1) {
          throw new Error(
            "MULTIPART_PAGE_INVALID"
          );
        }
        if (mergedPages.has(page)) {
          throw new Error(
            "MULTIPART_PAGE_DUPLICATION"
          );
        }
        mergedPages.add(page);
      }
    }
  }
  if (usablePartCount === 0) {
    return {
      status: hardFailureStatus(
        hardFailures
      ),
      messages: uniqueStrings([
        ...messages,
        ...warnings
      ])
    };
  }
  const aggregateWarnings = uniqueStrings(warnings);
  const aggregateMessages = uniqueStrings([
    ...messages,
    ...aggregateWarnings
  ]);
  const status = hardFailures.length > 0 || hasPartial || aggregateWarnings.length > 0 ? "PARTIAL" : "SUCCESS";
  return {
    status,
    data: {
      documentRef,
      fields: {
        records: mergedRecords,
        multipart: {
          totalParts: input.parts.length,
          usableParts: usablePartCount,
          failedParts: hardFailures.length,
          /**
           * Full per-part provenance.
           *
           * We intentionally do not synthesize a fake single
           * ProviderTrace from multiple provider attempts.
           */
          parts: provenance
        }
      },
      pages: [...mergedPages].sort(
        (a, b) => a - b
      ),
      warnings: aggregateWarnings
    },
    messages: aggregateMessages
    /**
     * Intentionally omitted.
     *
     * One logical multipart result may contain N independent
     * provider traces. They are preserved in fields.multipart.parts.
     */
  };
}

// packages/intelligence-adapters/src/document-extraction/document-extraction-document-composition.ts
function statusFromHoldReason(reason) {
  if (reason === "rate_limited") {
    return "RATE_LIMITED";
  }
  if (reason === "provider_unavailable") {
    return "UNAVAILABLE";
  }
  return "FAILED";
}
async function executeDocumentExtractionDocument(input) {
  const prepared = await prepareDocumentExtractionUnits({
    requestId: input.requestId,
    document: input.document,
    resolver: input.resolver
  });
  const units = [];
  for (const unit of prepared) {
    const execution = await executeDocumentExtractionUnit({
      documentRef: unit.documentRef,
      sourceRowKey: "row-1",
      adapterInput: unit.adapterInput,
      primary: input.primary,
      localFallback: input.localFallback
    });
    const result2 = execution.canonical ?? {
      status: statusFromHoldReason(
        execution.state.holdReason
      ),
      messages: [
        `DOCUMENT_EXTRACTION_UNIT_HOLD:${unit.partRef}:${execution.state.holdReason ?? "unknown"}`
      ]
    };
    units.push({
      partRef: unit.partRef,
      ...unit.pageRange ? {
        pageRange: unit.pageRange
      } : {},
      state: execution.state,
      result: result2
    });
  }
  const result = aggregateMultipartDocumentExtractions({
    documentRef: input.document.documentRef,
    parts: units.map(
      (unit) => ({
        partRef: unit.partRef,
        ...unit.pageRange ? {
          pageRange: unit.pageRange
        } : {},
        result: unit.result
      })
    )
  });
  return {
    units,
    result
  };
}

// packages/intelligence-core/src/document-extraction-execution-policy.ts
function validateDocumentExtractionTimeoutBudget(budget) {
  if (!Number.isFinite(budget.primaryMs) || !Number.isFinite(budget.localFallbackMs) || budget.primaryMs <= 0 || budget.localFallbackMs <= 0) {
    throw new Error(
      "DOCUMENT_EXTRACTION_TIMEOUT_BUDGET_INVALID"
    );
  }
  return budget;
}

// supabase/functions/intelligence-runtime/providers/gemini-document-extraction-transport.ts
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function latency(started) {
  return performance.now() - started;
}
function jsonText(payload) {
  try {
    return JSON.stringify(payload).toLowerCase();
  } catch {
    return "";
  }
}
function isBillingRequiredPayload(payload) {
  const text = jsonText(payload);
  return text.includes("billing_required") || text.includes("billing required") || text.includes("billing_not_enabled") || text.includes("billing not enabled") || text.includes("payment required");
}
function isPolicyViolationPayload(payload) {
  if (!payload) return false;
  const promptFeedback = payload.promptFeedback;
  if (promptFeedback && typeof promptFeedback === "object") {
    const blockReason = promptFeedback.blockReason;
    if (typeof blockReason === "string" && blockReason.length > 0 && blockReason !== "BLOCK_REASON_UNSPECIFIED") {
      return true;
    }
  }
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const blockedReasons = /* @__PURE__ */ new Set([
    "SAFETY",
    "BLOCKLIST",
    "PROHIBITED_CONTENT",
    "SPII",
    "RECITATION"
  ]);
  return candidates.some(
    (candidate) => {
      if (!candidate || typeof candidate !== "object") {
        return false;
      }
      const finishReason = candidate.finishReason;
      return typeof finishReason === "string" && blockedReasons.has(
        finishReason
      );
    }
  );
}
function createGeminiDocumentExtractionTransport(options) {
  const apiKey = options.apiKey.trim();
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_NOT_CONFIGURED");
  }
  return {
    async execute(request) {
      const startedAt = nowIso();
      const started = performance.now();
      let response;
      const controller = new AbortController();
      const timeoutMs = options.timeoutMs;
      const timeoutHandle = timeoutMs ? setTimeout(
        () => controller.abort(),
        timeoutMs
      ) : null;
      try {
        response = await fetchImpl(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent`,
          {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: request.instruction
                    },
                    {
                      inlineData: {
                        mimeType: request.mimeType,
                        data: request.contentBase64
                      }
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0,
                responseMimeType: "application/json"
              }
            })
          }
        );
      } catch (error) {
        return {
          ok: false,
          failure: controller.signal.aborted ? "timeout" : "transport_failure",
          startedAt,
          completedAt: nowIso(),
          latencyMs: latency(started)
        };
      }
      const requestRef = response.headers.get(
        "x-request-id"
      ) ?? void 0;
      const completedAt = nowIso();
      const latencyMs = latency(started);
      const errorPayload = !response.ok ? await response.clone().json().catch(() => null) : null;
      if (response.status === 402 || isBillingRequiredPayload(
        errorPayload
      )) {
        return {
          ok: false,
          failure: "billing_required",
          requestRef,
          startedAt,
          completedAt,
          latencyMs
        };
      }
      if (response.status === 429) {
        return {
          ok: false,
          failure: "rate_limited",
          requestRef,
          startedAt,
          completedAt,
          latencyMs
        };
      }
      if (response.status === 401) {
        return {
          ok: false,
          failure: "authentication_invalid",
          requestRef,
          startedAt,
          completedAt,
          latencyMs
        };
      }
      if (response.status === 403) {
        return {
          ok: false,
          failure: "access_denied",
          requestRef,
          startedAt,
          completedAt,
          latencyMs
        };
      }
      if (response.status >= 500) {
        return {
          ok: false,
          failure: "provider_unavailable",
          requestRef,
          startedAt,
          completedAt,
          latencyMs
        };
      }
      if (!response.ok) {
        return {
          ok: false,
          failure: "transport_failure",
          requestRef,
          startedAt,
          completedAt,
          latencyMs
        };
      }
      const payload = await response.json().catch(() => null);
      if (isPolicyViolationPayload(
        payload
      )) {
        return {
          ok: false,
          failure: "policy_violation",
          requestRef,
          startedAt,
          completedAt,
          latencyMs
        };
      }
      const candidates = payload && Array.isArray(
        payload.candidates
      ) ? payload.candidates : [];
      const first = candidates[0];
      const content = first && typeof first === "object" ? first.content : null;
      const parts = content && typeof content === "object" && Array.isArray(
        content.parts
      ) ? content.parts : [];
      const text = parts.map(
        (part) => part && typeof part === "object" && typeof part.text === "string" ? part.text : ""
      ).join("").trim();
      if (!text) {
        return {
          ok: false,
          failure: "transport_failure",
          requestRef,
          startedAt,
          completedAt,
          latencyMs
        };
      }
      return {
        ok: true,
        bodyText: text,
        requestRef,
        startedAt,
        completedAt,
        latencyMs
      };
    }
  };
}

// supabase/functions/intelligence-runtime/providers/ollama-document-extraction-transport.ts
function createOllamaDocumentExtractionTransport(options = {}) {
  const baseUrl = options.baseUrl.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error(
      "OLLAMA_LOCAL_BASE_URL_REQUIRED"
    );
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async execute(request) {
      const startedAt = (/* @__PURE__ */ new Date()).toISOString();
      const started = performance.now();
      let response;
      const controller = new AbortController();
      const timeoutMs = options.timeoutMs;
      const timeoutHandle = timeoutMs ? setTimeout(
        () => controller.abort(),
        timeoutMs
      ) : null;
      try {
        response = await fetchImpl(
          `${baseUrl}/api/chat`,
          {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: request.model,
              stream: false,
              format: "json",
              messages: [
                {
                  role: "user",
                  content: request.instruction,
                  images: [
                    request.contentBase64
                  ]
                }
              ]
            })
          }
        );
      } catch {
        return {
          ok: false,
          failure: controller.signal.aborted ? "timeout" : "provider_unavailable",
          startedAt,
          completedAt: (/* @__PURE__ */ new Date()).toISOString(),
          latencyMs: performance.now() - started
        };
      }
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      const completedAt = (/* @__PURE__ */ new Date()).toISOString();
      const latencyMs = performance.now() - started;
      if (!response.ok) {
        return {
          ok: false,
          failure: response.status >= 500 ? "provider_unavailable" : "transport_failure",
          startedAt,
          completedAt,
          latencyMs
        };
      }
      const payload = await response.json().catch(() => null);
      const message = payload && typeof payload.message === "object" && payload.message !== null ? payload.message : null;
      const bodyText = typeof message?.content === "string" ? message.content.trim() : "";
      if (!bodyText) {
        return {
          ok: false,
          failure: "transport_failure",
          startedAt,
          completedAt,
          latencyMs
        };
      }
      return {
        ok: true,
        bodyText,
        startedAt,
        completedAt,
        latencyMs
      };
    }
  };
}

// supabase/functions/intelligence-runtime/document-extraction-runtime-composition.ts
function createUnavailableLocalFallback() {
  return {
    providerId: OLLAMA_DOCUMENT_EXTRACTION_PROVIDER_ID,
    model: OLLAMA_DOCUMENT_EXTRACTION_MODEL,
    role: OLLAMA_DOCUMENT_EXTRACTION_ROLE,
    async extract() {
      const at = (/* @__PURE__ */ new Date()).toISOString();
      return {
        ok: false,
        failure: "provider_unavailable",
        trace: {
          provider: OLLAMA_DOCUMENT_EXTRACTION_PROVIDER_ID,
          model: OLLAMA_DOCUMENT_EXTRACTION_MODEL,
          role: OLLAMA_DOCUMENT_EXTRACTION_ROLE,
          startedAt: at,
          completedAt: at,
          latencyMs: 0,
          structuredOutputValid: null,
          evidenceAuthority: "RAW_VISIBLE_EVIDENCE"
        }
      };
    }
  };
}
function createDocumentExtractionRuntime(options) {
  const timeoutBudget = validateDocumentExtractionTimeoutBudget(
    options.timeoutBudget
  );
  const primary = new GeminiDocumentExtractionAdapter(
    createGeminiDocumentExtractionTransport({
      apiKey: options.geminiApiKey,
      timeoutMs: timeoutBudget.primaryMs,
      fetchImpl: options.geminiFetchImpl
    })
  );
  const localBaseUrl = options.ollamaBaseUrl?.trim();
  const localFallback = localBaseUrl ? new OllamaDocumentExtractionAdapter(
    createOllamaDocumentExtractionTransport({
      baseUrl: localBaseUrl,
      timeoutMs: timeoutBudget.localFallbackMs,
      fetchImpl: options.ollamaFetchImpl
    })
  ) : createUnavailableLocalFallback();
  return {
    timeoutBudget,
    localFallbackRuntime: localBaseUrl ? "LOCAL" : "UNAVAILABLE",
    async execute(input) {
      if (options.executeDocument) {
        return options.executeDocument({
          requestId: input.requestId,
          document: input.document,
          primary,
          localFallback
        });
      }
      return executeDocumentExtractionDocument({
        requestId: input.requestId,
        document: input.document,
        resolver: options.resolver,
        primary,
        localFallback
      });
    }
  };
}

// supabase/functions/intelligence-runtime/document-content-storage-resolver.ts
function required(value, code) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(code);
  }
  return normalized;
}
function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 32768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(
      offset,
      Math.min(
        offset + chunkSize,
        bytes.length
      )
    );
    binary += String.fromCharCode(
      ...chunk
    );
  }
  return btoa(binary);
}
function createSupabaseStorageDocumentContentResolver(options) {
  return {
    async resolve(document) {
      const documentRef = required(
        document.documentRef,
        "DOCUMENT_STORAGE_DOCUMENT_REF_REQUIRED"
      );
      const source = await options.resolveSource(
        document
      );
      if (!Array.isArray(source.parts) || source.parts.length === 0) {
        throw new Error(
          "DOCUMENT_STORAGE_PARTS_REQUIRED"
        );
      }
      const parts = [];
      for (const sourcePart of source.parts) {
        const partRef = required(
          sourcePart.partRef,
          "DOCUMENT_STORAGE_PART_REF_REQUIRED"
        );
        const bucket = required(
          sourcePart.bucket,
          "DOCUMENT_STORAGE_BUCKET_REQUIRED"
        );
        const path = required(
          sourcePart.path,
          "DOCUMENT_STORAGE_PATH_REQUIRED"
        );
        const mimeType = required(
          sourcePart.mimeType,
          "DOCUMENT_STORAGE_MIME_TYPE_REQUIRED"
        );
        const { data, error } = await options.client.storage.from(bucket).download(path);
        if (error || !data) {
          throw new Error(
            `DOCUMENT_STORAGE_DOWNLOAD_FAILED:${partRef}:${error?.message ?? "SOURCE_MISSING"}`
          );
        }
        const bytes = new Uint8Array(
          await data.arrayBuffer()
        );
        if (bytes.byteLength === 0) {
          throw new Error(
            `DOCUMENT_STORAGE_EMPTY:${partRef}`
          );
        }
        parts.push({
          partRef,
          mimeType,
          contentBase64: bytesToBase64(bytes),
          ...sourcePart.pageRange ? {
            pageRange: sourcePart.pageRange
          } : {},
          sourceUri: `supabase-storage://${bucket}/${path}`
        });
      }
      return {
        documentRef,
        ...source.sourceUri ? {
          sourceUri: source.sourceUri
        } : document.sourceUri ? {
          sourceUri: document.sourceUri
        } : {},
        ...source.fingerprint ? {
          fingerprint: source.fingerprint
        } : document.fingerprint ? {
          fingerprint: document.fingerprint
        } : {},
        parts
      };
    }
  };
}

// supabase/functions/intelligence-runtime/supplier-document-source-resolver.ts
var BUCKET = "supplier-source-documents";
function createSupplierDocumentSourceResolver(client) {
  return async (document) => {
    const documentId = document.documentRef.trim();
    if (!documentId) {
      throw new Error(
        "LIHEN_SUPPLIER_DOCUMENT_ID_REQUIRED"
      );
    }
    const { data, error } = await client.rpc(
      "get_supplier_source_document_runtime_controlled",
      {
        p_document_id: documentId
      }
    );
    if (error) {
      throw new Error(
        `LIHEN_SUPPLIER_DOCUMENT_RUNTIME_READ_FAILED:${error.message ?? "UNKNOWN"}`
      );
    }
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      throw new Error(
        "LIHEN_SUPPLIER_DOCUMENT_RUNTIME_RESULT_MISSING"
      );
    }
    const parts = rows.filter(
      (row) => row.part_number !== null && row.storage_path !== null
    ).map((row) => ({
      partRef: `part-${String(
        Number(row.part_number)
      ).padStart(4, "0")}`,
      bucket: BUCKET,
      path: String(
        row.storage_path
      ),
      mimeType: String(
        row.mime_type ?? "application/pdf"
      ),
      pageRange: {
        from: Number(row.page_start),
        to: Number(row.page_end)
      }
    }));
    if (parts.length === 0) {
      throw new Error(
        "LIHEN_SUPPLIER_DOCUMENT_PARTS_REQUIRED"
      );
    }
    const first = rows[0];
    return {
      sourceUri: String(
        first.source_reference ?? document.sourceUri ?? ""
      ) || void 0,
      fingerprint: String(
        first.source_sha256 ?? document.fingerprint ?? ""
      ) || void 0,
      parts
    };
  };
}

// supabase/functions/intelligence-runtime/sequential-storage-document-extraction.ts
function statusFromHoldReason2(reason) {
  if (reason === "rate_limited") {
    return "RATE_LIMITED";
  }
  if (reason === "provider_unavailable") {
    return "UNAVAILABLE";
  }
  return "FAILED";
}
function bytesToBase642(bytes) {
  let binary = "";
  const chunkSize = 32768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(
      offset,
      Math.min(
        offset + chunkSize,
        bytes.length
      )
    );
    binary += String.fromCharCode(
      ...chunk
    );
  }
  return btoa(binary);
}
function createSequentialSupabaseStorageDocumentExecution(options) {
  if (!Number.isFinite(options.maxPartBytes) || options.maxPartBytes <= 0) {
    throw new Error(
      "DOCUMENT_STORAGE_MAX_PART_BYTES_INVALID"
    );
  }
  return async (input) => {
    const source = await options.resolveSource(
      input.document
    );
    if (!Array.isArray(source.parts) || source.parts.length === 0) {
      throw new Error(
        "DOCUMENT_STORAGE_PARTS_REQUIRED"
      );
    }
    const units = [];
    for (let index = 0; index < source.parts.length; index += 1) {
      const sourcePart = source.parts[index];
      const processOnePart = async () => {
        const { data, error } = await options.client.storage.from(sourcePart.bucket).download(sourcePart.path);
        if (error || !data) {
          throw new Error(
            `DOCUMENT_STORAGE_DOWNLOAD_FAILED:${sourcePart.partRef}:${error?.message ?? "SOURCE_MISSING"}`
          );
        }
        if (data.size > options.maxPartBytes) {
          throw new Error(
            `DOCUMENT_STORAGE_PART_TOO_LARGE_FOR_EDGE:${sourcePart.partRef}:${data.size}`
          );
        }
        const bytes = new Uint8Array(
          await data.arrayBuffer()
        );
        if (bytes.byteLength === 0) {
          throw new Error(
            `DOCUMENT_STORAGE_EMPTY:${sourcePart.partRef}`
          );
        }
        const contentBase64 = bytesToBase642(bytes);
        const execution = await executeDocumentExtractionUnit({
          documentRef: input.document.documentRef,
          sourceRowKey: "row-1",
          adapterInput: {
            requestId: source.parts.length === 1 ? input.requestId : `${input.requestId}:part:${String(
              index + 1
            ).padStart(4, "0")}`,
            sourceDocumentId: input.document.documentRef,
            mimeType: sourcePart.mimeType,
            contentBase64
          },
          primary: input.primary,
          localFallback: input.localFallback
        });
        const result = execution.canonical ?? {
          status: statusFromHoldReason2(
            execution.state.holdReason
          ),
          messages: [
            `DOCUMENT_EXTRACTION_UNIT_HOLD:${sourcePart.partRef}:${execution.state.holdReason ?? "unknown"}`
          ]
        };
        return {
          partRef: sourcePart.partRef,
          ...sourcePart.pageRange ? {
            pageRange: sourcePart.pageRange
          } : {},
          state: execution.state,
          result
        };
      };
      units.push(
        await processOnePart()
      );
    }
    return {
      units,
      result: aggregateMultipartDocumentExtractions({
        documentRef: input.document.documentRef,
        parts: units.map(
          (unit) => ({
            partRef: unit.partRef,
            ...unit.pageRange ? {
              pageRange: unit.pageRange
            } : {},
            result: unit.result
          })
        )
      })
    };
  };
}
export {
  createDocumentExtractionRuntime,
  createSequentialSupabaseStorageDocumentExecution,
  createSupabaseStorageDocumentContentResolver,
  createSupplierDocumentSourceResolver
};
