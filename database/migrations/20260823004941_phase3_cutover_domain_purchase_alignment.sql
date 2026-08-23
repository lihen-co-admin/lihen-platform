-- FASE 3 — Alineación de dominio PURCHASE y estados diferidos del cutover.
-- Repo-sync de la migración ya aplicada en DEV.

update lihen_private.cutover_items
set domain = 'PURCHASE'
where domain = 'PROCUREMENT';

alter table lihen_private.cutover_items
  drop constraint if exists cutover_items_domain_check;

alter table lihen_private.cutover_items
  add constraint cutover_items_domain_check
  check (domain in ('PRODUCT','INVENTORY','SUPPLIER','PURCHASE','ORDER','SALE','FINANCE'));

alter table lihen_private.cutover_items
  drop constraint if exists cutover_items_match_status_check;

alter table lihen_private.cutover_items
  add constraint cutover_items_match_status_check
  check (match_status in ('MATCHED','AMBIGUOUS','UNMATCHED','BLOCKED','SKIPPED'));
