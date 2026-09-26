import { describe, expect, it, vi } from 'vitest';
import {
  MarketingSocialOperationKeyRequiredError,
  MarketingSocialWriteBlockedError,
  MarketingSocialWriteOperationConflictError,
  SupabaseMarketingSocialRepository,
} from '../src';
import type {
  ContentSchedule,
  PreparedPublication,
} from '../src';

function contentSchedule(): ContentSchedule {
  return {
    id: 'schedule-1',
    channelVariantId: 'variant-1',
    scheduledFor: new Date('2026-09-26T15:00:00-05:00'),
    timezone: 'America/Bogota',
    status: 'APPROVED',
    createdAt: new Date('2026-09-25T00:00:00-05:00'),
    updatedAt: new Date('2026-09-25T00:00:00-05:00'),
  };
}

function preparedPublication(): PreparedPublication {
  return {
    id: 'publication-1',
    campaignId: 'campaign-1',
    campaignContentId: 'content-1',
    channelVariantId: 'variant-1',
    scheduleId: 'schedule-1',
    channel: 'INSTAGRAM_FEED',
    copy: 'Prepared copy',
    callToAction: '',
    hashtags: [],
    creativeAssetIds: [],
    status: 'APPROVED',
    preparedAt: new Date('2026-09-25T00:00:00-05:00'),
  };
}

function queryResult(data: unknown, error: unknown = null) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(async () => ({ data, error }));
  builder.maybeSingle = vi.fn(async () => ({ data, error }));

  return builder;
}

describe('SupabaseMarketingSocialRepository safety boundary', () => {
  it('keeps all persistence writes blocked', async () => {
    const from = vi.fn();
    const rpc = vi.fn();

    const repository = new SupabaseMarketingSocialRepository({
      from,
      rpc,
    } as never);

    await expect(
      repository.saveContentSchedule(contentSchedule()),
    ).rejects.toBeInstanceOf(MarketingSocialWriteBlockedError);

    await expect(
      repository.savePreparedPublication(preparedPublication()),
    ).rejects.toBeInstanceOf(MarketingSocialWriteBlockedError);

    await expect(
      repository.createPendingPublicationAttempt(
        {
          id: 'attempt-1',
          preparedPublicationId: 'publication-1',
        },
        { operationKey: 'social-09-attempt' },
      ),
    ).rejects.toBeInstanceOf(MarketingSocialWriteBlockedError);

    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('reads and maps a content schedule by id', async () => {
    const query = queryResult({
      id: 'schedule-1',
      channel_variant_id: 'variant-1',
      scheduled_for: '2026-09-26T20:00:00.000Z',
      timezone: 'America/Bogota',
      status: 'APPROVED',
      created_at: '2026-09-25T05:00:00.000Z',
      updated_at: '2026-09-25T05:00:00.000Z',
    });
    const from = vi.fn(() => query);

    const repository = new SupabaseMarketingSocialRepository({
      from,
    } as never);

    const result =
      await repository.getContentScheduleById('schedule-1');

    expect(from).toHaveBeenCalledWith('marketing_content_schedules');
    expect(query.eq).toHaveBeenCalledWith('id', 'schedule-1');
    expect(result?.scheduledFor).toBeInstanceOf(Date);
    expect(result?.channelVariantId).toBe('variant-1');
    expect(result?.status).toBe('APPROVED');
  });

  it('returns null when a content schedule is absent', async () => {
    const query = queryResult(null);
    const repository = new SupabaseMarketingSocialRepository({
      from: vi.fn(() => query),
    } as never);

    await expect(
      repository.getContentScheduleById('missing'),
    ).resolves.toBeNull();
  });

  it('lists content schedules for a channel variant', async () => {
    const query = queryResult([
      {
        id: 'schedule-1',
        channel_variant_id: 'variant-1',
        scheduled_for: '2026-09-26T20:00:00.000Z',
        timezone: 'America/Bogota',
        status: 'APPROVED',
        created_at: '2026-09-25T05:00:00.000Z',
        updated_at: '2026-09-25T05:00:00.000Z',
      },
    ]);
    const from = vi.fn(() => query);

    const repository = new SupabaseMarketingSocialRepository({
      from,
    } as never);

    const result =
      await repository.listContentSchedulesByChannelVariantId(
        'variant-1',
      );

    expect(from).toHaveBeenCalledWith('marketing_content_schedules');
    expect(query.eq).toHaveBeenCalledWith(
      'channel_variant_id',
      'variant-1',
    );
    expect(query.order).toHaveBeenCalledWith('scheduled_for', {
      ascending: true,
    });
    expect(result).toHaveLength(1);
  });

  it('reads and maps a prepared publication by id', async () => {
    const query = queryResult({
      id: 'publication-1',
      campaign_id: 'campaign-1',
      campaign_content_id: 'content-1',
      channel_variant_id: 'variant-1',
      schedule_id: 'schedule-1',
      channel: 'INSTAGRAM_FEED',
      copy: 'Prepared copy',
      cta: null,
      hashtags: ['beauty'],
      creative_asset_ids: ['asset-1'],
      status: 'APPROVED',
      prepared_at: '2026-09-25T05:00:00.000Z',
    });
    const from = vi.fn(() => query);

    const repository = new SupabaseMarketingSocialRepository({
      from,
    } as never);

    const result =
      await repository.getPreparedPublicationById('publication-1');

    expect(from).toHaveBeenCalledWith(
      'marketing_prepared_publications',
    );
    expect(query.eq).toHaveBeenCalledWith('id', 'publication-1');
    expect(result?.callToAction).toBe('');
    expect(result?.preparedAt).toBeInstanceOf(Date);
    expect(result?.hashtags).toEqual(['beauty']);
  });

  it('returns null when a prepared publication is absent', async () => {
    const query = queryResult(null);
    const repository = new SupabaseMarketingSocialRepository({
      from: vi.fn(() => query),
    } as never);

    await expect(
      repository.getPreparedPublicationById('missing'),
    ).resolves.toBeNull();
  });

  it('lists prepared publications for a channel variant', async () => {
    const query = queryResult([]);
    const from = vi.fn(() => query);

    const repository = new SupabaseMarketingSocialRepository({
      from,
    } as never);

    const result =
      await repository.listPreparedPublicationsByChannelVariantId(
        'variant-1',
      );

    expect(from).toHaveBeenCalledWith(
      'marketing_prepared_publications',
    );
    expect(query.eq).toHaveBeenCalledWith(
      'channel_variant_id',
      'variant-1',
    );
    expect(query.order).toHaveBeenCalledWith('prepared_at', {
      ascending: true,
    });
    expect(result).toEqual([]);
  });

  it('lists and maps publication attempts in attempt order', async () => {
    const query = queryResult([
      {
        id: 'attempt-1',
        prepared_publication_id: 'publication-1',
        attempt_number: 1,
        status: 'FAILED',
        started_at: '2026-09-25T05:00:00.000Z',
        completed_at: '2026-09-25T05:01:00.000Z',
        external_publication_ref: null,
        failure_code: 'provider_unavailable',
      },
    ]);
    const from = vi.fn(() => query);

    const repository = new SupabaseMarketingSocialRepository({
      from,
    } as never);

    const result =
      await repository.listPublicationAttemptsByPreparedPublicationId(
        'publication-1',
      );

    expect(from).toHaveBeenCalledWith(
      'marketing_publication_attempts',
    );
    expect(query.eq).toHaveBeenCalledWith(
      'prepared_publication_id',
      'publication-1',
    );
    expect(query.order).toHaveBeenCalledWith('attempt_number', {
      ascending: true,
    });
    expect(result[0]?.startedAt).toBeInstanceOf(Date);
    expect(result[0]?.completedAt).toBeInstanceOf(Date);
    expect(result[0]?.failureCode).toBe('provider_unavailable');
  });

  it('propagates Supabase read errors without attempting a write', async () => {
    const error = new Error('read failed');
    const query = queryResult(null, error);
    const from = vi.fn(() => query);
    const rpc = vi.fn();

    const repository = new SupabaseMarketingSocialRepository({
      from,
      rpc,
    } as never);

    await expect(
      repository.getContentScheduleById('schedule-1'),
    ).rejects.toBe(error);

    expect(rpc).not.toHaveBeenCalled();
  });
});


describe('SupabaseMarketingSocialRepository controlled review writes', () => {
  it('keeps controlled writes disabled by default', async () => {
    const rpc = vi.fn();
    const repository = new SupabaseMarketingSocialRepository(
      { rpc } as never,
    );

    await expect(
      repository.saveContentSchedule(
        {
          id: '10000000-0000-0000-0000-000000000001',
          channelVariantId: '20000000-0000-0000-0000-000000000001',
          scheduledFor: new Date('2026-09-25T15:00:00.000Z'),
          timezone: 'America/Bogota',
          status: 'APPROVED',
          createdAt: new Date('2026-09-25T14:00:00.000Z'),
          updatedAt: new Date('2026-09-25T14:30:00.000Z'),
        },
        { operationKey: 'social-08-schedule' },
      ),
    ).rejects.toBeInstanceOf(MarketingSocialWriteBlockedError);

    expect(rpc).not.toHaveBeenCalled();
  });

  it('uses the controlled schedule RPC when explicitly enabled', async () => {
    const row = {
      id: '10000000-0000-0000-0000-000000000001',
      channel_variant_id: '20000000-0000-0000-0000-000000000001',
      scheduled_for: '2026-09-25T15:00:00.000Z',
      timezone: 'America/Bogota',
      status: 'APPROVED',
      created_at: '2026-09-25T14:00:00.000Z',
      updated_at: '2026-09-25T14:30:00.000Z',
    };
    const rpc = vi.fn().mockResolvedValue({ data: [row], error: null });
    const repository = new SupabaseMarketingSocialRepository(
      { rpc } as never,
      true,
    );

    const result = await repository.saveContentSchedule(
      {
        id: row.id,
        channelVariantId: row.channel_variant_id,
        scheduledFor: new Date(row.scheduled_for),
        timezone: row.timezone,
        status: 'APPROVED',
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      },
      { operationKey: ' social-08-schedule ' },
    );

    expect(rpc).toHaveBeenCalledWith(
      'save_marketing_content_schedule_controlled',
      expect.objectContaining({
        p_operation_key: 'social-08-schedule',
        p_id: row.id,
      }),
    );
    expect(result.id).toBe(row.id);
  });

  it('uses the controlled prepared-publication RPC when explicitly enabled', async () => {
    const row = {
      id: '30000000-0000-0000-0000-000000000001',
      campaign_id: '40000000-0000-0000-0000-000000000001',
      campaign_content_id: '50000000-0000-0000-0000-000000000001',
      channel_variant_id: '60000000-0000-0000-0000-000000000001',
      schedule_id: null,
      channel: 'INSTAGRAM_FEED',
      copy: 'Prepared copy',
      cta: null,
      hashtags: ['lihen'],
      creative_asset_ids: [],
      status: 'APPROVED',
      prepared_at: '2026-09-25T14:30:00.000Z',
    };
    const rpc = vi.fn().mockResolvedValue({ data: [row], error: null });
    const repository = new SupabaseMarketingSocialRepository(
      { rpc } as never,
      true,
    );

    const result = await repository.savePreparedPublication(
      {
        id: row.id,
        campaignId: row.campaign_id,
        campaignContentId: row.campaign_content_id,
        channelVariantId: row.channel_variant_id,
        scheduleId: null,
        channel: 'INSTAGRAM_FEED',
        copy: row.copy,
        callToAction: '',
        hashtags: row.hashtags,
        creativeAssetIds: [],
        status: 'APPROVED',
        preparedAt: new Date(row.prepared_at),
      },
      { operationKey: 'social-08-publication' },
    );

    expect(rpc).toHaveBeenCalledWith(
      'save_marketing_prepared_publication_controlled',
      expect.objectContaining({
        p_operation_key: 'social-08-publication',
        p_id: row.id,
      }),
    );
    expect(result.id).toBe(row.id);
  });

  it('rejects a blank operation key before calling the controlled RPC', async () => {
    const rpc = vi.fn();
    const repository = new SupabaseMarketingSocialRepository(
      { rpc } as never,
      true,
    );

    await expect(
      repository.saveContentSchedule(
        {
          id: '10000000-0000-0000-0000-000000000001',
          channelVariantId: '20000000-0000-0000-0000-000000000001',
          scheduledFor: new Date('2026-09-25T15:00:00.000Z'),
          timezone: 'America/Bogota',
          status: 'APPROVED',
          createdAt: new Date('2026-09-25T14:00:00.000Z'),
          updatedAt: new Date('2026-09-25T14:30:00.000Z'),
        },
        { operationKey: '   ' },
      ),
    ).rejects.toBeInstanceOf(MarketingSocialOperationKeyRequiredError);

    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps a controlled-write operation conflict to the social domain error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'LIHEN_MARKETING_SOCIAL_WRITE_OPERATION_CONFLICT',
      },
    });
    const repository = new SupabaseMarketingSocialRepository(
      { rpc } as never,
      true,
    );

    await expect(
      repository.saveContentSchedule(
        {
          id: '10000000-0000-0000-0000-000000000001',
          channelVariantId: '20000000-0000-0000-0000-000000000001',
          scheduledFor: new Date('2026-09-25T15:00:00.000Z'),
          timezone: 'America/Bogota',
          status: 'APPROVED',
          createdAt: new Date('2026-09-25T14:00:00.000Z'),
          updatedAt: new Date('2026-09-25T14:30:00.000Z'),
        },
        { operationKey: 'social-08-conflict' },
      ),
    ).rejects.toBeInstanceOf(MarketingSocialWriteOperationConflictError);
  });

  it('uses only the controlled pending-attempt RPC when explicitly enabled', async () => {
    const row = {
      id: '70000000-0000-0000-0000-000000000001',
      prepared_publication_id:
        '30000000-0000-0000-0000-000000000001',
      attempt_number: 1,
      status: 'PENDING',
      started_at: null,
      completed_at: null,
      external_publication_ref: null,
      failure_code: null,
    };

    const rpc = vi.fn().mockResolvedValue({
      data: [row],
      error: null,
    });

    const repository = new SupabaseMarketingSocialRepository(
      { rpc } as never,
      true,
    );

    const result =
      await repository.createPendingPublicationAttempt(
        {
          id: row.id,
          preparedPublicationId:
            row.prepared_publication_id,
        },
        { operationKey: ' social-09-attempt ' },
      );

    expect(rpc).toHaveBeenCalledWith(
      'create_marketing_publication_attempt_controlled',
      {
        p_operation_key: 'social-09-attempt',
        p_id: row.id,
        p_prepared_publication_id:
          row.prepared_publication_id,
      },
    );

    expect(result).toEqual({
      id: row.id,
      preparedPublicationId:
        row.prepared_publication_id,
      attemptNumber: 1,
      status: 'PENDING',
      startedAt: null,
      completedAt: null,
      externalPublicationRef: null,
      failureCode: null,
    });
  });

  it('rejects a blank operation key before the pending-attempt RPC', async () => {
    const rpc = vi.fn();

    const repository = new SupabaseMarketingSocialRepository(
      { rpc } as never,
      true,
    );

    await expect(
      repository.createPendingPublicationAttempt(
        {
          id: '70000000-0000-0000-0000-000000000001',
          preparedPublicationId:
            '30000000-0000-0000-0000-000000000001',
        },
        { operationKey: '   ' },
      ),
    ).rejects.toBeInstanceOf(
      MarketingSocialOperationKeyRequiredError,
    );

    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps pending-attempt operation conflicts to the social domain error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message:
          'LIHEN_MARKETING_SOCIAL_WRITE_OPERATION_CONFLICT',
      },
    });

    const repository = new SupabaseMarketingSocialRepository(
      { rpc } as never,
      true,
    );

    await expect(
      repository.createPendingPublicationAttempt(
        {
          id: '70000000-0000-0000-0000-000000000001',
          preparedPublicationId:
            '30000000-0000-0000-0000-000000000001',
        },
        { operationKey: 'social-09-conflict' },
      ),
    ).rejects.toBeInstanceOf(
      MarketingSocialWriteOperationConflictError,
    );
  });

});
