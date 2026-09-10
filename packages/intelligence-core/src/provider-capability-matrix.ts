import type { IntelligenceCapabilityName } from './contracts';

/**
 * Names only the provider-neutral Intelligence ports that already exist.
 *
 * MessagingPort and SocialPublishingPort are intentionally excluded because
 * governed outbound delivery/publication is not an Intelligence provider tool.
 */
export type IntelligenceProviderPortName =
  | 'ModelPort'
  | 'VisionPort'
  | 'SearchPort'
  | 'DocumentExtractionPort'
  | 'ImageGenerationPort'
  | 'ImageTransformationPort'
  | 'ReportGenerationPort'
  | 'EmbeddingPort';

export type CapabilityImplementationStatus =
  | 'IMPLEMENTED'
  | 'ABSTRACT_ONLY';

export interface ProviderCapabilityBinding {
  readonly implementation: CapabilityImplementationStatus;
  readonly requiredPorts: readonly IntelligenceProviderPortName[];
  readonly optionalPorts: readonly IntelligenceProviderPortName[];
}

/**
 * LIHEN Provider Capability Matrix.
 *
 * This matrix records the current code contract only.
 * It does not select vendors, configure credentials, add adapters, retries,
 * persistence, messaging delivery, social publication, or business authority.
 *
 * Empty port arrays mean no direct Intelligence provider dependency exists in
 * the current implementation. ABSTRACT_ONLY means a capability name exists in
 * orchestration/contracts but has no production handler implementation yet.
 */
export const PROVIDER_CAPABILITY_MATRIX = {
  VISION: {
    implementation: 'ABSTRACT_ONLY',
    requiredPorts: [],
    optionalPorts: [],
  },
  SEARCH: {
    implementation: 'ABSTRACT_ONLY',
    requiredPorts: [],
    optionalPorts: [],
  },
  VERIFICATION: {
    implementation: 'ABSTRACT_ONLY',
    requiredPorts: [],
    optionalPorts: [],
  },
  PRODUCT_INTELLIGENCE: {
    implementation: 'IMPLEMENTED',
    requiredPorts: [],
    optionalPorts: [],
  },
  BRAND_INTELLIGENCE: {
    implementation: 'IMPLEMENTED',
    requiredPorts: ['SearchPort', 'VisionPort'],
    optionalPorts: [],
  },
  CATALOG_INTELLIGENCE: {
    implementation: 'ABSTRACT_ONLY',
    requiredPorts: [],
    optionalPorts: [],
  },
  DOCUMENT_INTELLIGENCE: {
    implementation: 'IMPLEMENTED',
    requiredPorts: ['DocumentExtractionPort'],
    optionalPorts: ['VisionPort', 'SearchPort'],
  },
  REPORT_GENERATION: {
    implementation: 'IMPLEMENTED',
    requiredPorts: [],
    optionalPorts: ['ReportGenerationPort'],
  },
  CREATIVE_INTELLIGENCE: {
    implementation: 'IMPLEMENTED',
    requiredPorts: [],
    optionalPorts: ['ImageGenerationPort'],
  },
  IMAGE_TRANSFORMATION: {
    implementation: 'IMPLEMENTED',
    requiredPorts: [],
    optionalPorts: ['ImageTransformationPort'],
  },
  CUSTOMER_INTELLIGENCE: {
    implementation: 'IMPLEMENTED',
    requiredPorts: [],
    optionalPorts: [],
  },
  MARKETING_INTELLIGENCE: {
    implementation: 'IMPLEMENTED',
    requiredPorts: [],
    optionalPorts: [],
  },
  CONVERSATION_INTELLIGENCE: {
    implementation: 'IMPLEMENTED',
    requiredPorts: [],
    optionalPorts: [],
  },
  ANALYTICS: {
    implementation: 'IMPLEMENTED',
    requiredPorts: [],
    optionalPorts: [],
  },
  AUTOMATION: {
    implementation: 'IMPLEMENTED',
    requiredPorts: [],
    optionalPorts: [],
  },
  AUDIT_INTELLIGENCE: {
    implementation: 'IMPLEMENTED',
    requiredPorts: [],
    optionalPorts: [],
  },
  ASSISTANT: {
    implementation: 'IMPLEMENTED',
    requiredPorts: [],
    optionalPorts: ['ModelPort'],
  },
} as const satisfies Readonly<
  Record<IntelligenceCapabilityName, ProviderCapabilityBinding>
>;

export function getProviderCapabilityBinding(
  capability: IntelligenceCapabilityName,
): ProviderCapabilityBinding {
  return PROVIDER_CAPABILITY_MATRIX[capability];
}
