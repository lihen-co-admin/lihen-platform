/** Official Graph read-only metadata. No registration, onboarding, template or send authority. */
export async function readWhatsAppReadiness(
  env: (name: string) => string | undefined,
  request: typeof fetch = fetch,
) {
  const requiredPermissions = ['whatsapp_business_management', 'whatsapp_business_messaging'];
  if (
    env('SUPABASE_URL') !== 'https://vnmkupzptujtywnnabkp.supabase.co' ||
    env('WHATSAPP_PREFLIGHT_ENABLED') !== 'true'
  )
    throw new Error('WHATSAPP_PREFLIGHT_DISABLED_OR_NON_DEV');
  const version = env('META_GRAPH_API_VERSION') ?? '',
    token = env('WHATSAPP_ACCESS_TOKEN') ?? '';
  const wabaId = env('WHATSAPP_WABA_ID') ?? '',
    phoneNumberId = env('WHATSAPP_PHONE_NUMBER_ID') ?? '';
  if (
    !/^v\d+\.\d+$/.test(version) ||
    !token.trim() ||
    !/^\d+$/.test(wabaId) ||
    !/^\d+$/.test(phoneNumberId)
  )
    throw new Error('WHATSAPP_NOT_CONFIGURED');
  async function get(path: string) {
    const result = await request(`https://graph.facebook.com/${version}/${path}`, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    if (!result.ok) throw new Error(`WHATSAPP_HTTP_${result.status}`);
    const data = await result.json();
    if (!data || data.error || !Array.isArray(data.data))
      throw new Error('WHATSAPP_RESPONSE_INVALID');
    return data.data as Record<string, unknown>[];
  }
  const permissions = await get('me/permissions');
  const grantedRequiredPermissions = requiredPermissions.filter((permission) =>
    permissions.some((row) => row.permission === permission && row.status === 'granted'),
  );
  const missingRequiredPermissions = requiredPermissions.filter(
    (permission) => !grantedRequiredPermissions.includes(permission),
  );
  const phones = await get(
    `${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,platform_type,is_on_biz_app,code_verification_status&limit=100`,
  );
  const phone = phones.find((row) => row.id === phoneNumberId);
  if (!phone) throw new Error('WHATSAPP_PHONE_NOT_VERIFIED_IN_ACCOUNT_PAGE');
  const safe = (value: unknown) =>
    typeof value === 'string' && !value.includes(token.trim()) ? value.slice(0, 160) : null;
  const isOnBizApp = phone.is_on_biz_app === true;
  const platformType = safe(phone.platform_type);
  const coexistenceConfirmed = isOnBizApp && platformType === 'CLOUD_API';
  return {
    status:
      coexistenceConfirmed && !missingRequiredPermissions.length ? 'READ_ONLY_READY' : 'BLOCKED',
    reason: !coexistenceConfirmed
      ? 'COEXISTENCE_NOT_CONFIRMED'
      : missingRequiredPermissions.length
        ? 'REQUIRED_PERMISSIONS_MISSING'
        : null,
    wabaId,
    phoneNumberId,
    displayPhoneNumber: safe(phone.display_phone_number),
    verifiedName: safe(phone.verified_name),
    qualityRating: safe(phone.quality_rating),
    platformType,
    isOnBizApp,
    coexistenceConfirmed,
    codeVerificationStatus: safe(phone.code_verification_status),
    requiredPermissions,
    grantedRequiredPermissions,
    missingRequiredPermissions,
    sendingEnabled: false as const,
    requestId: null,
  };
}
