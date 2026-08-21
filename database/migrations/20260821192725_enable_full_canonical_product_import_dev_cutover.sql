-- DEV cutover only. Business authorization is still enforced inside the RPC.
grant execute on function public.import_full_canonical_products_controlled(text,uuid) to authenticated;
