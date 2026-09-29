import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditorialOperations } from '../src/composition/editorial-operations';
import * as policy from '../../../supabase/functions/marketing-social-runtime/operational-policy';
import * as tiktok from '../../../supabase/functions/marketing-social-runtime/tiktok-provider';

const compiledRuntime = transformSync(
  readFileSync('supabase/functions/marketing-social-runtime/index.ts', 'utf8'),
  { loader: 'ts', format: 'cjs' },
).code;

// Execute the real Edge request handler with local auth, persistence and provider doubles.
// No Supabase client or network transport is instantiated.
function runtime(transport: tiktok.TikTokTransport | null = null) {
  const publication = {
    id: 'publication',
    campaign_id: 'campaign',
    campaign_content_id: 'content',
    channel_variant_id: 'variant',
    schedule_id: 'schedule',
    channel: 'FACEBOOK',
    copy: 'Approved copy',
    cta: '',
    hashtags: [],
    creative_asset_ids: ['image'],
    status: 'APPROVED',
    prepared_at: '2026-01-01',
  };
  const schedule = {
    id: 'schedule',
    channel_variant_id: 'variant',
    status: 'APPROVED',
    scheduled_for: '2026-01-01',
  };
  const attempts: Record<string, unknown>[] = [];
  const env: Record<string, string> = {
    MARKETING_SOCIAL_ENVIRONMENT: 'DEV',
    SUPABASE_ANON_KEY: 'fake',
    SUPABASE_SERVICE_ROLE_KEY: 'fake',
    META_PUBLICATION_ENABLED: 'false',
    META_GRAPH_API_VERSION: 'fake',
    META_FACEBOOK_ACCESS_TOKEN: 'fake',
    META_FACEBOOK_PAGE_ID: 'fake',
  };
  let role = 'OWNER';
  let videoStatus = 'ACTIVE';
  let videoProduct = 'product';
  let videoMime = 'video/mp4';
  let evidenceFails = false;
  let completeFails = false;
  const from = vi.fn((table: string) => {
    const result = () => ({
      data:
        table === 'profiles'
          ? { id: 'actor', role_code: role, authorization_status: 'ACTIVE' }
          : table === 'marketing_prepared_publications'
            ? { ...publication }
            : table === 'marketing_content_schedules'
              ? { ...schedule }
              : attempts.map((a) => ({ ...a })),
      error: null,
    });
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => Promise.resolve(result()),
      single: () => Promise.resolve(result()),
      maybeSingle: () => Promise.resolve(result()),
    };
    return query;
  });
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'get_marketing_editorial_video_assets')
      return {
        data: [
          {
            id: 'video',
            product_id: videoProduct,
            public_url: 'https://example.invalid/reel.mp4',
            mime_type: videoMime,
            status: videoStatus,
          },
        ],
        error: null,
      };
    if (name === 'get_product_images')
      return {
        data: [
          {
            id: 'image',
            product_id: 'product',
            public_url: 'https://example.invalid/image.jpg',
            status: 'ACTIVE',
          },
        ],
        error: null,
      };
    if (name === 'append_marketing_tiktok_evidence_server_controlled') {
      if (evidenceFails) return { data: null, error: { message: 'Evidence unavailable' } };
      const evidence = (attempts[0]!.provider_evidence ?? []) as unknown[];
      evidence.push(args.p_evidence);
      attempts[0]!.provider_evidence = evidence;
      return { data: null, error: null };
    }
    if (name === 'create_marketing_publication_attempt_server_controlled') {
      if (!attempts.length)
        attempts.push({
          id: args.p_id,
          prepared_publication_id: publication.id,
          status: 'PENDING',
        });
      return { data: [{ ...attempts[0] }], error: null };
    }
    if (name === 'get_marketing_publication_execution_server_controlled')
      return {
        data: [
          {
            ...publication,
            publication_id: publication.id,
            publication_status: publication.status,
            prepared_publication_id: publication.id,
            attempt_status: attempts[0]?.status,
          },
        ],
        error: null,
      };
    if (name === 'start_marketing_publication_attempt_server_controlled') {
      if (attempts[0]?.status !== 'PENDING')
        return { data: null, error: { message: 'Not pending' } };
      attempts[0]!.status = 'IN_PROGRESS';
      return { data: [{ ...attempts[0] }], error: null };
    }
    if (name === 'complete_marketing_publication_attempt_server_controlled') {
      if (completeFails) return { data: null, error: { message: 'Completion unavailable' } };
      attempts[0]!.status = args.p_outcome;
      attempts[0]!.external_publication_ref = args.p_result_value;
      return { data: [{ ...attempts[0] }], error: null };
    }
    throw new Error(`Unexpected RPC ${name}`);
  });
  let handler: (request: Request) => Promise<Response>;
  const fetchMock = vi.fn(
    async (url: string | URL) =>
      new Response(
        JSON.stringify(
          String(url).includes('status_code')
            ? { status_code: 'FINISHED' }
            : { id: 'test-external-reference' },
        ),
      ),
  );
  const client = {
    from,
    rpc,
    auth: { getUser: async () => ({ data: { user: { id: 'actor' } }, error: null }) },
  };
  new Function('require', 'Deno', 'fetch', compiledRuntime)(
    (name: string) =>
      name === 'supabase'
        ? { createClient: () => client }
        : name.includes('tiktok-provider')
          ? {
              ...tiktok,
              configuredTikTokTransport: (
                _config: tiktok.TikTokConfig,
                creator: tiktok.TikTokCreator | null = null,
              ) => (transport ? { ...transport, creator } : null),
            }
          : policy,
    {
      env: { get: (name: string) => env[name] },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
    fetchMock,
  );
  const call = async (action: string, payload: Record<string, unknown> = {}, authorized = true) => {
    const response = await handler(
      new Request('https://runtime.invalid', {
        method: 'POST',
        headers: authorized ? { Authorization: 'Bearer fake' } : {},
        body: JSON.stringify({ action, payload }),
      }),
    );
    return { status: response.status, body: await response.json() };
  };
  const context = async () =>
    transport?.creator
      ? tiktok.signTikTokCreator(
          tiktok.tikTokConfig((name) => env[name]),
          {
            actorId: 'actor',
            publicationId: publication.id,
            productId: 'product',
            media: { publicUrl: 'https://example.invalid/reel.mp4', mediaType: 'VIDEO' },
          },
          transport.creator,
        )
      : null;
  const assess = async () =>
    call('ASSESS_PUBLICATION_OPERATION', {
      preparedPublicationId: publication.id,
      productId: 'product',
      ...(transport?.creator
        ? {
            tiktokChoices: {
              creatorRevision: transport.creator.revision,
              privacy: 'SELF_ONLY',
              consent: true,
              interactions: {},
            },
            tiktokCreatorContext: await context(),
          }
        : {}),
    });
  const confirm = async (action: string, snapshot?: string) => {
    const current = await assess();
    return call(action, {
      preparedPublicationId: publication.id,
      productId: 'product',
      attemptId: attempts[0]?.id,
      expectedSnapshot: snapshot ?? current.body.data?.snapshot,
      confirmedAction: action,
      ...(transport?.creator
        ? {
            tiktokChoices: {
              creatorRevision: transport.creator.revision,
              privacy: 'SELF_ONLY',
              consent: true,
              interactions: {},
            },
            tiktokCreatorContext: await context(),
          }
        : {}),
    });
  };
  return {
    publication,
    schedule,
    attempts,
    env,
    rpc,
    fetchMock,
    call,
    assess,
    confirm,
    setRole: (value: string) => {
      role = value;
    },
    failCompletion: () => {
      completeFails = true;
    },
    setVideoStatus: (value: string) => {
      videoStatus = value;
    },
    setVideoProduct: (value: string) => {
      videoProduct = value;
    },
    setVideoMime: (value: string) => {
      videoMime = value;
    },
    failEvidence: () => {
      evidenceFails = true;
    },
  };
}

afterEach(() => vi.restoreAllMocks());

function fakeTikTok() {
  const creator: tiktok.TikTokCreator = {
    accountId: 'test-creator',
    revision: 'revision-1',
    expiresAt: '2099-01-01',
    privacyOptions: ['SELF_ONLY'],
    consentText: 'Test provider consent',
    controlsSupported: true,
    maxVideoDurationSec: 120,
    interactions: [],
  };
  return {
    creator,
    contractVerified: true,
    physicalVerificationAvailable: true,
    authorizedScopes: ['video.publish'],
    queryCreator: vi.fn(async () => creator),
    verifyVideo: vi.fn(async () => true),
    initialize: vi.fn(async () => ({ publishId: 'test-publish-id' })),
    status: vi.fn(async (): Promise<tiktok.TikTokStatus> => ({ state: 'PROCESSING' })),
  };
}
function tikTokRuntime() {
  const provider = fakeTikTok();
  const r = runtime(provider);
  r.publication.channel = 'TIKTOK';
  r.publication.creative_asset_ids = ['video'];
  r.env.TIKTOK_PUBLICATION_ENABLED = 'true';
  r.env.TIKTOK_ACCESS_TOKEN = 'local-test-only';
  r.env.TIKTOK_VERIFIED_URL_PREFIX = 'https://example.invalid/';
  r.env.TIKTOK_CONTEXT_SIGNING_KEY = 'test-only-signing-key-at-least-32-characters';
  r.env.TIKTOK_AUTHORIZED_SCOPES = 'video.publish';
  for (const key of Object.keys(r.env)) if (key.startsWith('META_')) delete r.env[key];
  return { ...r, provider };
}

describe('TikTok governed runtime — local normalized provider only', () => {
  it('blocks unmeasurable duration before START despite browser metadata and URLs', async () => {
    const r = tikTokRuntime();
    r.provider.physicalVerificationAvailable = false;
    const result = await r.call('ASSESS_PUBLICATION_OPERATION', {
      preparedPublicationId: 'publication',
      productId: 'product',
      durationSeconds: 1,
      verifiedEtag: '"browser-claim"',
      videoUrl: 'https://attacker.invalid/video.mp4',
      physicalVerificationAvailable: true,
    });
    expect(result.body.data.blockers).toContain('TIKTOK_VIDEO_DURATION_VERIFICATION_UNAVAILABLE');
    await r.confirm('CREATE_PUBLICATION_ATTEMPT');
    await r.confirm('EXECUTE_PUBLICATION_ATTEMPT');
    expect(r.attempts).toHaveLength(0);
    expect(r.provider.queryCreator).not.toHaveBeenCalled();
    expect(r.provider.initialize).not.toHaveBeenCalled();
    expect(r.fetchMock).not.toHaveBeenCalled();
  });
  it('rejects multiple videos and missing authorization before START', async () => {
    const r = tikTokRuntime();
    r.publication.creative_asset_ids = ['video', 'second'];
    expect((await r.assess()).body.data.blockers).toContain('TIKTOK_SINGLE_VIDEO_REQUIRED');
    r.publication.creative_asset_ids = ['video'];
    r.provider.authorizedScopes = [];
    expect((await r.assess()).body.data.blockers).toContain('TIKTOK_VIDEO_PUBLISH_SCOPE_REQUIRED');
    await r.confirm('CREATE_PUBLICATION_ATTEMPT');
    expect(r.attempts).toHaveLength(0);
    expect(r.provider.queryCreator).not.toHaveBeenCalled();
  });
  it('assessment and CREATE never call provider; accepted processing stays IN_PROGRESS with durable evidence', async () => {
    const r = tikTokRuntime();
    expect((await r.assess()).body.data.nextAction).toBe('CREATE_PUBLICATION_ATTEMPT');
    expect((await r.confirm('CREATE_PUBLICATION_ATTEMPT')).status).toBe(200);
    expect(r.provider.queryCreator).not.toHaveBeenCalled();
    expect(r.provider.initialize).not.toHaveBeenCalled();
    const response = await r.confirm('EXECUTE_PUBLICATION_ATTEMPT');
    expect(response.body.error).toBe('TIKTOK_RECONCILIATION_REQUIRED');
    expect(response.body.externalPublication).toBe(false);
    expect(r.attempts[0]?.status).toBe('IN_PROGRESS');
    expect(r.attempts[0]?.provider_evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'CONSENT', privacy: 'SELF_ONLY', consent: true }),
        { kind: 'ACCEPTED', publishId: 'test-publish-id' },
        { kind: 'PROCESSING', publishId: 'test-publish-id' },
      ]),
    );
    await r.confirm('EXECUTE_PUBLICATION_ATTEMPT');
    await r.confirm('CREATE_PUBLICATION_ATTEMPT');
    expect(r.provider.initialize).toHaveBeenCalledTimes(1);
    expect(r.attempts).toHaveLength(1);
    expect(r.fetchMock).not.toHaveBeenCalled();
  });
  it.each(['TIKTOK_PUBLICATION_ENABLED', 'TIKTOK_ACCESS_TOKEN', 'TIKTOK_VERIFIED_URL_PREFIX'])(
    'blocks missing %s before START',
    async (key) => {
      const r = tikTokRuntime();
      await r.confirm('CREATE_PUBLICATION_ATTEMPT');
      delete r.env[key];
      expect((await r.confirm('EXECUTE_PUBLICATION_ATTEMPT')).status).toBe(400);
      expect(r.attempts[0]?.status).toBe('PENDING');
      expect(r.rpc.mock.calls.some(([name]) => name.startsWith('start_'))).toBe(false);
      expect(r.provider.queryCreator).not.toHaveBeenCalled();
    },
  );
  it.each(['missing', 'archived', 'wrong-product', 'image'])(
    'blocks %s video and browser URL bypass',
    async (problem) => {
      const r = tikTokRuntime();
      if (problem === 'missing') r.publication.creative_asset_ids = [];
      if (problem === 'archived') r.setVideoStatus('ARCHIVED');
      if (problem === 'wrong-product') r.setVideoProduct('other');
      if (problem === 'image') r.setVideoMime('image/png');
      expect((await r.assess()).body.data.blockers.length).toBeGreaterThan(0);
      await r.call('EXECUTE_PUBLICATION_ATTEMPT', {
        preparedPublicationId: 'publication',
        productId: 'product',
        videoUrl: 'https://attacker.invalid/video.mp4',
        confirmedAction: 'EXECUTE_PUBLICATION_ATTEMPT',
      });
      expect(r.provider.initialize).not.toHaveBeenCalled();
      expect(r.rpc.mock.calls.some(([name]) => name.startsWith('start_'))).toBe(false);
    },
  );
  it('requires fresh explicit confirmation including privacy and consent', async () => {
    const r = tikTokRuntime();
    await r.confirm('CREATE_PUBLICATION_ATTEMPT');
    const before = await r.assess();
    const payload = {
      preparedPublicationId: 'publication',
      productId: 'product',
      attemptId: 'publication',
      expectedSnapshot: before.body.data.snapshot,
    };
    expect((await r.call('EXECUTE_PUBLICATION_ATTEMPT', payload)).status).toBe(400);
    r.publication.copy = 'changed';
    expect((await r.confirm('EXECUTE_PUBLICATION_ATTEMPT', before.body.data.snapshot)).status).toBe(
      400,
    );
    expect(r.provider.initialize).not.toHaveBeenCalled();
  });
  it('uses only durable video URL and succeeds only from verified terminal completion', async () => {
    const r = tikTokRuntime();
    r.provider.status.mockResolvedValue({
      state: 'COMPLETE',
      publicationRef: 'verified-final-ref',
    });
    await r.confirm('CREATE_PUBLICATION_ATTEMPT');
    const a = (await r.assess()).body.data;
    const result = await r.call('EXECUTE_PUBLICATION_ATTEMPT', {
      preparedPublicationId: 'publication',
      productId: 'product',
      attemptId: 'publication',
      expectedSnapshot: a.snapshot,
      confirmedAction: a.nextAction,
      tiktokChoices: a.tiktokChoices,
      tiktokCreatorContext: a.tiktokCreatorContext,
      videoUrl: 'https://attacker.invalid/a.mp4',
    });
    expect(result.body.externalPublication).toBe(true);
    expect(r.attempts[0]?.status).toBe('SUCCEEDED');
    expect(r.attempts[0]?.external_publication_ref).toBe('verified-final-ref');
    expect(r.provider.initialize.mock.calls[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ videoUrl: 'https://example.invalid/reel.mp4' }),
      ]),
    );
    expect(r.fetchMock).not.toHaveBeenCalled();
  });
  it('records a terminal failure and never reuses the attempt', async () => {
    const r = tikTokRuntime();
    r.provider.status.mockResolvedValue({ state: 'FAILED', code: 'TEST_TERMINAL_FAILURE' });
    await r.confirm('CREATE_PUBLICATION_ATTEMPT');
    expect((await r.confirm('EXECUTE_PUBLICATION_ATTEMPT')).body.externalPublication).toBe(false);
    expect(r.attempts[0]?.status).toBe('FAILED');
    await r.confirm('EXECUTE_PUBLICATION_ATTEMPT');
    expect(r.provider.initialize).toHaveBeenCalledTimes(1);
  });
  it.each(['UNKNOWN', 'malformed', 'exception', 'evidence', 'completion'])(
    'requires reconciliation after %s',
    async (problem) => {
      const r = tikTokRuntime();
      await r.confirm('CREATE_PUBLICATION_ATTEMPT');
      if (problem === 'UNKNOWN') r.provider.status.mockResolvedValue({ state: 'UNKNOWN' });
      if (problem === 'malformed')
        r.provider.status.mockResolvedValue({ state: 'COMPLETE' } as tiktok.TikTokStatus);
      if (problem === 'exception')
        r.provider.status.mockRejectedValue(new Error('network timeout'));
      if (problem === 'evidence')
        r.provider.initialize.mockImplementation(async () => {
          r.failEvidence();
          return { publishId: 'test-publish-id' };
        });
      if (problem === 'completion') {
        r.provider.status.mockResolvedValue({ state: 'COMPLETE', publicationRef: 'verified-ref' });
        r.failCompletion();
      }
      expect((await r.confirm('EXECUTE_PUBLICATION_ATTEMPT')).status).toBe(409);
      expect(r.attempts[0]?.status).toBe('IN_PROGRESS');
      await r.confirm('EXECUTE_PUBLICATION_ATTEMPT');
      expect(r.provider.initialize).toHaveBeenCalledTimes(1);
    },
  );
  it('only one concurrent execution can initialize and replay cannot initialize again', async () => {
    const r = tikTokRuntime();
    await r.confirm('CREATE_PUBLICATION_ATTEMPT');
    await Promise.all([
      r.confirm('EXECUTE_PUBLICATION_ATTEMPT'),
      r.confirm('EXECUTE_PUBLICATION_ATTEMPT'),
    ]);
    expect(r.provider.initialize).toHaveBeenCalledTimes(1);
    expect(r.attempts[0]?.status).toBe('IN_PROGRESS');
  });
});

describe('governed operational closure — real handler, local doubles only', () => {
  it('assesses without writes, creates PENDING only after confirmation, then requires separate execution approval', async () => {
    const r = runtime();
    expect((await r.assess()).body.data.nextAction).toBe('CREATE_PUBLICATION_ATTEMPT');
    expect(r.attempts).toHaveLength(0);
    expect(r.fetchMock).not.toHaveBeenCalled();
    expect(
      (
        await r.call('CREATE_PUBLICATION_ATTEMPT', {
          preparedPublicationId: 'publication',
          productId: 'product',
        })
      ).status,
    ).toBe(400);
    expect((await r.confirm('CREATE_PUBLICATION_ATTEMPT')).status).toBe(200);
    expect(r.attempts[0]?.status).toBe('PENDING');
    expect((await r.assess()).body.data.blockers).toContain('META_PUBLICATION_DISABLED');
    expect((await r.confirm('EXECUTE_PUBLICATION_ATTEMPT')).status).toBe(400);
    expect(r.fetchMock).not.toHaveBeenCalled();
    r.env.META_PUBLICATION_ENABLED = 'true';
    expect((await r.confirm('EXECUTE_PUBLICATION_ATTEMPT')).body.externalPublication).toBe(true);
    expect(r.attempts[0]?.status).toBe('SUCCEEDED');
    expect(r.fetchMock).toHaveBeenCalledTimes(1);
    expect((await r.confirm('EXECUTE_PUBLICATION_ATTEMPT')).status).toBe(400);
    expect(r.fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(['TIKTOK', 'WHATSAPP_DIRECT'])(
    'blocks unsupported channel %s before any writes/provider calls',
    async (channel) => {
      const r = runtime();
      r.publication.channel = channel;
      expect((await r.assess()).body.data.blockers).toContain(
        channel === 'TIKTOK' ? 'TIKTOK_PUBLICATION_DISABLED' : 'CHANNEL_UNAVAILABLE',
      );
      expect((await r.confirm('CREATE_PUBLICATION_ATTEMPT')).status).toBe(400);
      expect(r.attempts).toHaveLength(0);
      expect(r.fetchMock).not.toHaveBeenCalled();
    },
  );
  it('rejects stale approval after persisted copy changes', async () => {
    const r = runtime();
    const before = await r.assess();
    r.publication.copy = 'Changed';
    expect((await r.confirm('CREATE_PUBLICATION_ATTEMPT', before.body.data.snapshot)).status).toBe(
      400,
    );
    expect(r.attempts).toHaveLength(0);
  });
  it.each(['INSTAGRAM_FEED', 'INSTAGRAM_STORY'])(
    'uses the existing %s image runtime with a fake provider only',
    async (channel) => {
      const r = runtime();
      r.publication.channel = channel;
      r.env.META_INSTAGRAM_ACCESS_TOKEN = 'fake';
      r.env.META_INSTAGRAM_ACCOUNT_ID = 'fake';
      await r.confirm('CREATE_PUBLICATION_ATTEMPT');
      r.env.META_PUBLICATION_ENABLED = 'true';
      expect((await r.confirm('EXECUTE_PUBLICATION_ATTEMPT')).status).toBe(200);
      expect(r.fetchMock).toHaveBeenCalledTimes(3);
      expect(r.attempts[0]?.status).toBe('SUCCEEDED');
    },
  );
  it('publishes an Instagram Reel only from an authorized persisted video asset', async () => {
    const r = runtime();
    r.publication.channel = 'INSTAGRAM_REEL';
    r.publication.creative_asset_ids = ['video'];
    r.env.META_INSTAGRAM_ACCESS_TOKEN = 'fake';
    r.env.META_INSTAGRAM_ACCOUNT_ID = 'fake';
    expect((await r.assess()).body.data.nextAction).toBe('CREATE_PUBLICATION_ATTEMPT');
    await r.confirm('CREATE_PUBLICATION_ATTEMPT');
    r.env.META_PUBLICATION_ENABLED = 'true';
    expect((await r.confirm('EXECUTE_PUBLICATION_ATTEMPT')).status).toBe(200);
    const createCall = r.fetchMock.mock.calls[0] as unknown as [string | URL, RequestInit];
    const createBody = String(createCall[1]?.body ?? '');
    expect(createBody).toContain('media_type=REELS');
    expect(createBody).toContain('video_url=https%3A%2F%2Fexample.invalid%2Freel.mp4');
    expect(r.attempts[0]?.status).toBe('SUCCEEDED');
  });

  it('blocks Reel when its persisted creative asset is not an authorized video', async () => {
    const r = runtime();
    r.publication.channel = 'INSTAGRAM_REEL';
    r.publication.creative_asset_ids = ['image'];
    r.env.META_INSTAGRAM_ACCESS_TOKEN = 'fake';
    r.env.META_INSTAGRAM_ACCOUNT_ID = 'fake';
    const assessed = await r.assess();
    expect(assessed.body.data.blockers).toContain('REEL_VIDEO_NOT_AUTHORIZED');
    expect(assessed.body.data.nextAction).toBeNull();
    expect(r.fetchMock).not.toHaveBeenCalled();
  });

  it('blocks Reel when the persisted video asset is inactive', async () => {
    const r = runtime();
    r.publication.channel = 'INSTAGRAM_REEL';
    r.publication.creative_asset_ids = ['video'];
    r.setVideoStatus('ARCHIVED');
    const assessed = await r.assess();
    expect(assessed.body.data.blockers).toContain('REEL_VIDEO_NOT_AUTHORIZED');
    expect(assessed.body.data.nextAction).toBeNull();
    expect(r.fetchMock).not.toHaveBeenCalled();
  });

  it('rereads the selected publication and its attempts without provider calls', async () => {
    const r = runtime();
    await r.confirm('CREATE_PUBLICATION_ATTEMPT');
    const result = await r.call('READ_EDITORIAL_WORKSPACE', {
      preparedPublicationId: 'publication',
    });
    expect(result.body.data.publications[0].id).toBe('publication');
    expect(result.body.data.attempts[0].status).toBe('PENDING');
    expect(r.fetchMock).not.toHaveBeenCalled();
  });
  it('blocks multiple pending attempts, missing media and unapproved publication', async () => {
    const r = runtime();
    r.attempts.push({ id: 'a', status: 'PENDING' }, { id: 'b', status: 'PENDING' });
    r.publication.status = 'PREPARED';
    r.publication.creative_asset_ids = [];
    expect((await r.assess()).body.data.blockers).toEqual(
      expect.arrayContaining([
        'PUBLICATION_NOT_APPROVED',
        'MEDIA_REQUIRED',
        'PRODUCT_MEDIA_NOT_AUTHORIZED',
        'ATTEMPT_REQUIRES_RECONCILIATION_NO_RETRY',
      ]),
    );
    expect(r.fetchMock).not.toHaveBeenCalled();
  });
  it.each(['FAILED', 'CANCELLED', 'IN_PROGRESS', 'SUCCEEDED'])(
    'never reuses or replaces %s attempts',
    async (status) => {
      const r = runtime();
      r.attempts.push({ id: 'old', status });
      expect((await r.assess()).body.data.nextAction).toBeNull();
      expect((await r.confirm('CREATE_PUBLICATION_ATTEMPT')).status).toBe(400);
      expect((await r.confirm('EXECUTE_PUBLICATION_ATTEMPT')).status).toBe(400);
      expect(r.attempts).toHaveLength(1);
      expect(r.fetchMock).not.toHaveBeenCalled();
    },
  );
  it('fails closed for auth, role and server environment', async () => {
    const r = runtime();
    expect((await r.call('ASSESS_PUBLICATION_OPERATION', {}, false)).status).toBe(401);
    r.setRole('VIEWER');
    expect((await r.assess()).status).toBe(403);
    r.setRole('ADMIN');
    r.env.MARKETING_SOCIAL_ENVIRONMENT = 'PROD';
    expect((await r.assess()).status).toBe(409);
    expect(r.rpc).not.toHaveBeenCalled();
    expect(r.fetchMock).not.toHaveBeenCalled();
  });
  it('only one concurrent request wins START and contacts the fake provider', async () => {
    const r = runtime();
    await r.confirm('CREATE_PUBLICATION_ATTEMPT');
    r.env.META_PUBLICATION_ENABLED = 'true';
    await Promise.all([
      r.confirm('EXECUTE_PUBLICATION_ATTEMPT'),
      r.confirm('EXECUTE_PUBLICATION_ATTEMPT'),
    ]);
    expect(r.fetchMock).toHaveBeenCalledTimes(1);
    const starts = r.rpc.mock.calls.filter(
      ([name]) => name === 'start_marketing_publication_attempt_server_controlled',
    );
    expect(new Set(starts.map(([, args]) => args.p_operation_key)).size).toBe(starts.length);
  });
  it('keeps an uncertain completion IN_PROGRESS and blocks another execution', async () => {
    const r = runtime();
    await r.confirm('CREATE_PUBLICATION_ATTEMPT');
    r.env.META_PUBLICATION_ENABLED = 'true';
    r.failCompletion();
    expect((await r.confirm('EXECUTE_PUBLICATION_ATTEMPT')).status).toBe(409);
    expect(r.attempts[0]?.status).toBe('IN_PROGRESS');
    expect((await r.assess()).body.data.nextAction).toBeNull();
    expect(r.fetchMock).toHaveBeenCalledTimes(1);
  });
  it('rejects future, unapproved and mismatched schedules', async () => {
    const r = runtime();
    r.schedule.scheduled_for = '2099-01-01';
    r.schedule.status = 'DRAFT';
    r.schedule.channel_variant_id = 'other';
    expect((await r.assess()).body.data.blockers).toEqual(
      expect.arrayContaining(['NOT_DUE', 'SCHEDULE_NOT_APPROVED', 'SCHEDULE_LINK_INVALID']),
    );
    expect((await r.confirm('CREATE_PUBLICATION_ATTEMPT')).status).toBe(400);
  });
});

describe('operational client', () => {
  it('does not invoke transport outside DEV', async () => {
    const invoke = vi.fn();
    await expect(
      createEditorialOperations({ functions: { invoke } }, false).assess('p', 'product'),
    ).rejects.toThrow('DEV');
    expect(invoke).not.toHaveBeenCalled();
  });
  it('never automatically retries an ambiguous request', async () => {
    const invoke = vi.fn().mockRejectedValue(new Error('Transport lost'));
    await expect(
      createEditorialOperations({ functions: { invoke } }, true).assess('p', 'product'),
    ).rejects.toThrow('Transport lost');
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
