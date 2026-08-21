-- PENDING CUTOVER ONLY — do not apply before JWT/profile/authorization gates are green.
grant execute on function public.change_product_sale_price_controlled(text, uuid, uuid, numeric, text, text) to authenticated;
