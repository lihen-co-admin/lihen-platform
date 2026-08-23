grant execute on function public.create_product_controlled(
  text, uuid, text, text, text, text, text, uuid, uuid, text, numeric
) to authenticated;

revoke insert, update, delete on table public.products from authenticated;

comment on function public.create_product_controlled(
  text, uuid, text, text, text, text, text, uuid, uuid, text, numeric
) is 'Phase 2.2 DEV controlled CreateProduct entry point. Requires authenticated ACTIVE OWNER/ADMIN inside the function; direct products table writes remain revoked.';
