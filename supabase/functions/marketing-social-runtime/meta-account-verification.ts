import { META_GRAPH_ORIGIN, META_AUTHORIZATION_FLOW } from './meta-contract.ts';
/** Explicit read-only verification. No publishing endpoint, token or raw Graph error is returned. */
export async function verifyMetaAccounts(
  env: (name: string) => string | undefined,
  transport: typeof fetch = fetch,
) {
  if (
    env('SUPABASE_URL') !== 'https://vnmkupzptujtywnnabkp.supabase.co' ||
    env('MARKETING_SOCIAL_ENVIRONMENT') !== 'DEV'
  )
    throw new Error('META_VERIFICATION_DEV_REQUIRED');
  const version = env('META_GRAPH_API_VERSION')?.trim();
  if (!version || !/^v\d+\.\d+$/.test(version)) throw new Error('META_GRAPH_VERSION_INVALID');
  let providerCalls = 0;
  const read = async (resource: string, token: string) => {
    providerCalls++;
    try {
      const response = await transport(`${META_GRAPH_ORIGIN}/${version}/${resource}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return null;
      if (!response.body) return null;
      const reader = response.body.getReader();
      const parts: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 65536) {
            await reader.cancel();
            return null;
          }
          parts.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const part of parts) {
        bytes.set(part, offset);
        offset += part.byteLength;
      }
      return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  const accounts = await Promise.all(
    (
      [
        [
          'FACEBOOK',
          'META_FACEBOOK_PAGE_ID',
          'META_FACEBOOK_ACCESS_TOKEN',
          ['pages_read_engagement', 'pages_manage_posts'],
        ],
        [
          'INSTAGRAM',
          'META_INSTAGRAM_ACCOUNT_ID',
          'META_INSTAGRAM_ACCESS_TOKEN',
          ['instagram_basic', 'instagram_content_publish'],
        ],
      ] as const
    ).map(async ([channel, idName, tokenName, required]) => {
      const id = env(idName)?.trim(),
        token = env(tokenName)?.trim();
      if (!id || !/^\d+$/.test(id) || !token)
        return {
          channel,
          accountVerified: false,
          permissionsVerified: false,
          blockers: ['ACCOUNT_CONFIGURATION_MISSING'],
          grantedPermissions: [] as string[],
        };
      const [account, permissions] = await Promise.all([
        read(
          `${id}?fields=${channel === 'FACEBOOK' ? 'id,instagram_business_account' : 'id'}`,
          token,
        ),
        read('me/permissions', token),
      ]);
      const accountVerified = account?.id === id;
      const linked = account?.instagram_business_account as { id?: unknown } | undefined;
      const instagramPageLinkVerified =
        channel === 'FACEBOOK' &&
        typeof linked?.id === 'string' &&
        linked.id === env('META_INSTAGRAM_ACCOUNT_ID')?.trim();
      const grantedPermissions = Array.isArray(permissions?.data)
        ? permissions.data.flatMap((row: unknown) => {
            if (!row || typeof row !== 'object') return [];
            const p = row as { permission?: unknown; status?: unknown };
            return p.status === 'granted' &&
              typeof p.permission === 'string' &&
              /^[a-z_]+$/.test(p.permission)
              ? [p.permission]
              : [];
          })
        : [];
      const permissionsVerified = required.every((name) => grantedPermissions.includes(name));
      return {
        channel,
        accountVerified,
        instagramPageLinkVerified,
        permissionsVerified,
        grantedPermissions,
        blockers: [
          ...(!accountVerified ? ['ACCOUNT_READ_NOT_VERIFIED'] : []),
          ...(!permissionsVerified ? ['PUBLISHING_PERMISSIONS_NOT_VERIFIED'] : []),
          ...(channel === 'FACEBOOK' && !instagramPageLinkVerified
            ? ['INSTAGRAM_PAGE_LINK_NOT_VERIFIED']
            : []),
        ],
      };
    }),
  );
  return {
    schemaVersion: 1 as const,
    authorizationFlow: META_AUTHORIZATION_FLOW,
    providerCalls,
    executionAllowed: false as const,
    accounts,
    restrictions: [
      'READ_ONLY',
      'APP_REVIEW_AND_ACCOUNT_ELIGIBILITY_NOT_ATTESTED',
      'NO_MESSAGES_OR_COMMENTS_SENT',
      'HUMAN_PUBLICATION_APPROVAL_REQUIRED',
    ],
  };
}
