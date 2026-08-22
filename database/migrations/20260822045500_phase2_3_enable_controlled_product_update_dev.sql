-- FASE 2.3 — Product Update controlled cutover / Supabase DEV.
--
-- La edición de identidad del Product Master se habilita únicamente mediante
-- la RPC controlada. Precio, stock, imágenes y publicación siguen fuera de
-- este comando para conservar responsabilidades e historiales separados.

revoke all on function public.update_product_controlled(
  text, uuid, text, text, text, text, text, uuid, uuid, text
) from public;

revoke all on function public.update_product_controlled(
  text, uuid, text, text, text, text, text, uuid, uuid, text
) from anon;

grant execute on function public.update_product_controlled(
  text, uuid, text, text, text, text, text, uuid, uuid, text
) to authenticated;

grant execute on function public.update_product_controlled(
  text, uuid, text, text, text, text, text, uuid, uuid, text
) to service_role;

-- No se abre UPDATE directo al navegador.
revoke insert, update, delete on table public.products from authenticated;
