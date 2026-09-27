import { getBrowserSupabaseClient } from '@lihen/database';

export interface WhatsAppPreflightResult {
  readonly status: string;
  readonly reason: string | null;
  readonly wabaId: string;
  readonly phoneNumberId: string;
  readonly displayPhoneNumber: string | null;
  readonly verifiedName: string | null;
  readonly qualityRating: string | null;
  readonly platformType: string | null;
  readonly isOnBizApp: boolean;
  readonly coexistenceConfirmed: boolean;
  readonly codeVerificationStatus: string | null;
  readonly requiredPermissions: readonly string[];
  readonly grantedRequiredPermissions: readonly string[];
  readonly missingRequiredPermissions: readonly string[];
  readonly sendingEnabled: boolean;
  readonly requestId: string | null;
}

export async function runWhatsAppPreflight(): Promise<WhatsAppPreflightResult> {
  const client = getBrowserSupabaseClient(import.meta.env);

  const { data, error } = await client.functions.invoke<WhatsAppPreflightResult>(
    'conversation-whatsapp-runtime',
    {
      body: {
        action: 'WHATSAPP_PREFLIGHT',
        payload: {},
      },
    },
  );

  if (error) {
    const context = (
      error as {
        readonly context?: {
          json?: () => Promise<unknown>;
        };
      }
    ).context;

    if (context?.json) {
      try {
        const body = await context.json();

        if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
          throw new Error(body.error);
        }
      } catch (cause) {
        if (cause instanceof Error) {
          throw cause;
        }
      }
    }

    throw new Error(`LIHEN_WHATSAPP_PREFLIGHT_INVOKE_FAILED:${error.message ?? 'UNKNOWN'}`);
  }

  if (!data || typeof data.coexistenceConfirmed !== 'boolean') {
    throw new Error('LIHEN_WHATSAPP_PREFLIGHT_INVALID_RESPONSE');
  }

  return data;
}
