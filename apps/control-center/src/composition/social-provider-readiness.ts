import { getBrowserSupabaseClient } from '@lihen/database';
import { z } from 'zod';
const reportSchema = z.object({
  schemaVersion: z.literal(1),
  providerCalls: z.literal(0),
  executionAllowed: z.literal(false),
  providers: z.array(
    z.object({
      channel: z.enum([
        'FACEBOOK',
        'INSTAGRAM_FEED',
        'INSTAGRAM_STORY',
        'INSTAGRAM_REEL',
        'TIKTOK',
      ]),
      status: z.enum(['BLOCKED', 'REVIEW']),
      blockers: z.array(z.string()),
      restrictions: z.array(z.string()),
    }),
  ),
});
export type SocialProviderReadiness = z.infer<typeof reportSchema>;
const accountReportSchema = z.object({
  schemaVersion: z.literal(1),
  providerCalls: z.number().int().min(0).max(4),
  executionAllowed: z.literal(false),
  accounts: z.array(
    z.object({
      channel: z.enum(['FACEBOOK', 'INSTAGRAM']),
      accountVerified: z.boolean(),
      instagramPageLinkVerified: z.boolean().optional(),
      permissionsVerified: z.boolean(),
      grantedPermissions: z.array(z.string()),
      blockers: z.array(z.string()),
    }),
  ),
  restrictions: z.array(z.string()),
});
export type MetaAccountVerification = z.infer<typeof accountReportSchema>;
export async function readMetaAccountVerification(
  client = getBrowserSupabaseClient(import.meta.env),
): Promise<MetaAccountVerification> {
  const { data, error } = await client.functions.invoke('marketing-social-runtime', {
    body: { action: 'VERIFY_META_ACCOUNTS', payload: {} },
  });
  if (error)
    throw new Error(
      'Verificación Meta no disponible. Requiere sesión OWNER/ADMIN y runtime actualizado en DEV.',
    );
  if (data?.externalPublication !== false)
    throw new Error('Respuesta de verificación Meta inválida.');
  return accountReportSchema.parse(data.data);
}
export async function readSocialProviderReadiness(
  client = getBrowserSupabaseClient(import.meta.env),
): Promise<SocialProviderReadiness> {
  const { data, error } = await client.functions.invoke('marketing-social-runtime', {
    body: { action: 'READ_PROVIDER_READINESS', payload: {} },
  });
  if (error)
    throw new Error(
      'Diagnóstico no disponible. Verifica sesión y despliegue de READ_PROVIDER_READINESS.',
    );
  if (data?.externalPublication !== false) throw new Error('Respuesta de diagnóstico inválida.');
  return reportSchema.parse(data.data);
}
