-- Re-lock immediately after the one-time DEV cutover and idempotency replay.
revoke execute on function public.import_full_canonical_products_controlled(text,uuid) from authenticated, anon, public;
grant execute on function public.import_full_canonical_products_controlled(text,uuid) to postgres;
