# TIKTOK-01 — governed Direct Post DEV

DEV only. PROD HOLD. Automatic scheduler OFF. WhatsApp SEND OFF. No real
TikTok/Meta publication, credentials, deployment, local/remote migration execution,
or remote Supabase operation was performed. No commit/push/merge.

## Implemented

The Edge runtime resolves one ACTIVE, product-authorized durable video through
`get_marketing_editorial_video_assets`. Browser/request URLs never replace that
asset. Editorial approval, separate CREATE/EXECUTE confirmations and fresh snapshot
checks remain in place. The composer selects and rehydrates existing video assets.

`tiktok-http.ts` implements injectable POST transport for creator_info/query,
video/init and status/fetch under `https://open.tiktokapis.com/v2/post/publish/`.
It uses Bearer authorization, JSON and video.publish authorization metadata.
Official fields are fixed in code: creator_username, privacy_level_options,
max_video_post_duration_sec, comment/duet/stitch_disabled, post_info.title,
privacy_level, disable_comment/duet/stitch, source_info.source=PULL_FROM_URL,
source_info.video_url, data.publish_id, data.status and error.code=ok.
TIKTOK_WIRE_CONTRACT and arbitrary JSON-path configuration have been removed.
No exact field used by this adapter remains an operator-configurable uncertainty.

The creator context uses a bounded lifetime and server HMAC bound to the actor,
publication, governed media and configuration. Assessment/save/CREATE never contact
TikTok. The explicit creator read is implemented but currently blocked by the
physical-verification prerequisite. Unaudited privacy remains SELF_ONLY.

Official schema references:

- [Creator info](https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info)
- [Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post)
- [Status](https://developers.tiktok.com/docs/en/content-posting-api-reference-get-video-status)

## Fail-closed physical verification

No existing bounded server-side video duration measurement implementation was found
in the repository. Production transport therefore advertises
`physicalVerificationAvailable: false`; assessment/execution returns the explicit
`TIKTOK_VIDEO_DURATION_VERIFICATION_UNAVAILABLE` blocker before START or video/init.
This is a server implementation capability, with no environment or browser override.
Only isolated test doubles supply successful physical verification.

The server HEAD check remains injectable, restricted to the configured HTTPS
origin/path, abort-bounded to 10 seconds and redirect-rejecting. It rejects missing,
weak or malformed ETags, invalid sizes, objects above the local conservative 100 MiB
limit and unsupported MIME types. It sends no TikTok credentials to media URLs.
Even a valid HEAD always returns false: an observed ETag does not certify duration
or bind a measurement to immutable bytes. There is no trusted expected ETag to compare.
A future authorized implementation must measure actual bytes, bind that measurement
to the object/version and compare duration with fresh creator limits before init.
No duration is fabricated or accepted from browser/OWNER/ADMIN. No ffmpeg, workers,
upload subsystem or manual metadata RPC was added.

The official adapter also leaves `controlsSupported: false`: commercial-content
disclosures and provider-required consent UX are not fully represented by this
increment. Existing interaction mappings do not claim complete product compliance.
This remains blocked rather than inventing missing choices or defaults.

## Async evidence and migration

The only TIKTOK-01 migration retained is
`20260928160000_marketing_tiktok_attempt_evidence.sql`, unchanged in this correction.
It adds provider_evidence and a service-only append RPC validating ACTIVE OWNER/ADMIN,
TikTok channel and IN_PROGRESS under a row lock.
`20260928161000_marketing_tiktok_video_duration.sql` was removed; runtime and fixtures
no longer depend on its RPC or persisted duration/ETag columns.

The orchestration persists consent before initialization and publish_id before status.
ACCEPTED is not SUCCEEDED. Only PUBLISH_COMPLETE maps to terminal success; FAILED
maps to failure. PROCESSING_DOWNLOAD/PROCESSING_UPLOAD, unknown, malformed and timed-out
results leave IN_PROGRESS. The terminal reference is an operation reference, not a
public post URL. Calls are bounded; no automatic retry, second initialization,
scheduler, reconciliation worker or resume command is added. Failed evidence writes
never authorize retry. Failure after provider acceptance can lose publish_id and
requires investigation while the durable IN_PROGRESS stop prevents re-execution.

## Remaining prerequisites and validation

Actual server-side physical verification is outside this increment. Complete the
required disclosure/consent controls under separately authorized scope. External
activation also requires app/account authorization, a valid video.publish grant,
TikTok-verified domain/prefix, accessible immutable media and applicable audit/private
account restrictions. An environment prefix alone does not prove TikTok ownership
verification. Review/apply the evidence migration and deploy to DEV only with separate
authorization; none of those actions was performed here.

Tests inject fake HTTP and persistence. They cover fixed official wire fields,
fail-closed HEAD, browser override rejection, physical blocker before START,
consent/acceptance ordering, terminal/intermediate states, failed evidence and replay.
Successful orchestration fixtures are test-only capabilities, not activation evidence.
Final local gates use packageManager pnpm 10.15.0: focused TikTok tests, full Vitest
suite, architecture tests, lint, typecheck, build and git diff --check. Gate results
are reported with this worktree review. Pre-existing build artifacts are preserved;
new generated gate artifacts are removed.
