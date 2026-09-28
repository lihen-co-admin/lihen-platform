import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL(
    '../../database/migrations/20260928113000_marketing_editorial_video_asset_foundation.sql',
    import.meta.url,
  ),
  'utf8',
)

describe('marketing editorial video asset foundation', () => {
  it('uses a dedicated public Storage bucket restricted to video MIME types', () => {
    expect(migration).toContain("'lihen-editorial-video'")
    expect(migration).toContain("array['video/mp4','video/quicktime']::text[]")
    expect(migration).toContain('104857600')
  })

  it('restricts Storage mutations to authenticated active OWNER/ADMIN users', () => {
    expect(migration).toContain('for insert')
    expect(migration).toContain('for update')
    expect(migration).toContain('for delete')
    expect(migration).toContain("p.authorization_status = 'ACTIVE'")
    expect(migration).toContain("p.role_code in ('OWNER','ADMIN')")
  })

  it('requires durable Storage-backed metadata and canonical Reel paths', () => {
    expect(migration).toContain('storage_bucket text not null')
    expect(migration).toContain('storage_path text not null')
    expect(migration).toContain("check (source_type = 'STORAGE')")
    expect(migration).toContain(
      "check (storage_bucket = 'lihen-editorial-video')",
    )
    expect(migration).toContain(
      "'products/' || product_id::text || '/reels/' || id::text",
    )
  })

  it('binds the public URL to the governed bucket and storage path', () => {
    expect(migration).toContain(
      "'%/storage/v1/object/public/lihen-editorial-video/' || storage_path",
    )
    expect(migration).not.toContain('HUMAN_PROVIDED')
  })

  it('keeps direct authenticated table reads closed and exposes governed RPC reads', () => {
    expect(migration).toContain(
      'revoke all on table public.marketing_editorial_video_assets',
    )
    expect(migration).toContain(
      'grant select on table public.marketing_editorial_video_assets',
    )
    expect(migration).toContain('to service_role')
    expect(migration).toContain(
      'public.get_marketing_editorial_video_assets',
    )
    expect(migration).toContain('LIHEN_MARKETING_EDITORIAL_VIDEO_READ_FORBIDDEN')
  })
})
