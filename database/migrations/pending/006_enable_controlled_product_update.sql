-- CUTOVER PENDIENTE — NO aplicar hasta cerrar JWT real + OWNER/ADMIN ACTIVE + aprobación explícita.
grant execute on function public.update_product_controlled(text, uuid, text, text, text, uuid, uuid, text)
to authenticated;
