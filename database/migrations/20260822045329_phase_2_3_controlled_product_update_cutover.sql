revoke all on function public.update_product_controlled(text, uuid, text, text, text, text, text, uuid, uuid, text) from public;
revoke all on function public.update_product_controlled(text, uuid, text, text, text, text, text, uuid, uuid, text) from anon;
grant execute on function public.update_product_controlled(text, uuid, text, text, text, text, text, uuid, uuid, text) to authenticated;
grant execute on function public.update_product_controlled(text, uuid, text, text, text, text, text, uuid, uuid, text) to service_role;

-- Product Master remains protected from direct authenticated writes.
revoke insert, update, delete on table public.products from authenticated;
