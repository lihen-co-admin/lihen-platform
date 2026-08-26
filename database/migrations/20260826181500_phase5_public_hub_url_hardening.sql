-- FASE 5 · Public Hub CUT 4
-- Defense-in-depth for public navigation and presentation URLs.
-- Forward-only and non-destructive. Product Master remains canonical.

alter table lihen_private.public_hub_blocks
  add constraint public_hub_blocks_target_url_protocol_check
  check (
    target_url is null
    or target_url ~* '^(https?://|mailto:|tel:)'
  );

alter table lihen_private.public_hub_blocks
  add constraint public_hub_blocks_image_url_protocol_check
  check (
    image_url is null
    or image_url ~* '^https?://'
  );

comment on constraint public_hub_blocks_target_url_protocol_check on lihen_private.public_hub_blocks
  is 'Public Hub navigation destinations are limited to http(s), mailto and tel schemes.';

comment on constraint public_hub_blocks_image_url_protocol_check on lihen_private.public_hub_blocks
  is 'Public Hub presentation images are limited to http(s) URLs; product media continues to resolve canonically.';
