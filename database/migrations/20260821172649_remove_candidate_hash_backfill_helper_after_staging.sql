-- FASE 1.21.1 cleanup — remove temporary SHA-256 backfill helper after staging verification.
drop function if exists lihen_private.backfill_candidate_hash_lines(uuid,text);
