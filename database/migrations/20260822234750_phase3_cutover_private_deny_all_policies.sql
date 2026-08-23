-- FASE 3 — Explicit private DENY ALL policies
-- Repo-sync copy of migration already applied in DEV at version 20260822234750.

drop policy if exists cutover_execution_batches_deny_all on lihen_private.cutover_execution_batches;
create policy cutover_execution_batches_deny_all
on lihen_private.cutover_execution_batches
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists cutover_execution_receipts_deny_all on lihen_private.cutover_execution_receipts;
create policy cutover_execution_receipts_deny_all
on lihen_private.cutover_execution_receipts
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists cutover_post_verifications_deny_all on lihen_private.cutover_post_verifications;
create policy cutover_post_verifications_deny_all
on lihen_private.cutover_post_verifications
for all
to anon, authenticated
using (false)
with check (false);
