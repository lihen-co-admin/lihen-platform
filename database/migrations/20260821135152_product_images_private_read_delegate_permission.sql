grant usage on schema lihen_private to authenticated;
grant execute on function lihen_private.get_product_images_authorized(uuid) to authenticated;
revoke usage on schema lihen_private from anon;
revoke execute on function lihen_private.get_product_images_authorized(uuid) from anon, public;
