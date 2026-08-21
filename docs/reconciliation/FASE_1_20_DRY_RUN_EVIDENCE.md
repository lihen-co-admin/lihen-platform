# FASE 1.20 Dry-run evidence

```json
{
  "phase": "1.20",
  "source": "CATALOGO_LIHEN_V5_ACTL_V1.pdf",
  "brandReferences": 46,
  "categoryReferences": 5,
  "statusCounts": {
    "NEW_ENTITY": 47,
    "REVIEW_REQUIRED": 4
  },
  "brandConfidenceCounts": {
    "HIGH": 42,
    "LOW": 3,
    "MEDIUM": 1
  },
  "categoryConfidenceCounts": {
    "HIGH": 5
  },
  "reviewRequired": [
    {
      "referenceId": "CATV1-BRAND-P010",
      "entityType": "BRAND",
      "displayName": "CBD - logo circular (nombre exacto por confirmar)",
      "sourcePage": 10,
      "sourceConfidence": "LOW",
      "reasons": [
        "SOURCE_REVIEW_REQUIRED"
      ]
    },
    {
      "referenceId": "CATV1-BRAND-P013",
      "entityType": "BRAND",
      "displayName": "D'L...? - logo caballito de mar (nombre exacto por confirmar)",
      "sourcePage": 13,
      "sourceConfidence": "LOW",
      "reasons": [
        "SOURCE_REVIEW_REQUIRED"
      ]
    },
    {
      "referenceId": "CATV1-BRAND-P162",
      "entityType": "BRAND",
      "displayName": "Majikal",
      "sourcePage": 162,
      "sourceConfidence": "MEDIUM",
      "reasons": [
        "SOURCE_REVIEW_REQUIRED"
      ]
    },
    {
      "referenceId": "CATV1-BRAND-P201",
      "entityType": "BRAND",
      "displayName": "M - logo monograma (nombre exacto por confirmar)",
      "sourcePage": 201,
      "sourceConfidence": "LOW",
      "reasons": [
        "SOURCE_REVIEW_REQUIRED"
      ]
    }
  ],
  "gates": {
    "insertBrands": false,
    "insertCategories": false,
    "backfillProducts": false,
    "browserAccess": false
  }
}
```
