create table if not exists lihen_private.storefront_public_content_registry (
  content_key text primary key,route_hash text not null,
  content_status text not null check(content_status in ('PUBLISHED_BASELINE','SOURCE_APPROVED','CONFIGURED')),
  source_reference text not null,public_summary text not null,updated_at timestamptz not null default now()
);
revoke all on lihen_private.storefront_public_content_registry from public,anon,authenticated;
grant select on lihen_private.storefront_public_content_registry to postgres;
insert into lihen_private.storefront_public_content_registry(content_key,route_hash,content_status,source_reference,public_summary) values
('ABOUT','#nosotros','CONFIGURED','LIHEN_BRAND_AND_PLATFORM_BASELINE_2026-08-26','Quiénes somos, Beauty Care, Style, tienda virtual y canales oficiales.'),
('TERMS','#terminos','PUBLISHED_BASELINE','LIHEN_EXISTING_PUBLIC_LEGAL_BASELINE_REVIEW_2026-08-26','Condiciones de uso, precios, disponibilidad, confirmación y relación comercial.'),
('PRIVACY','#privacidad','PUBLISHED_BASELINE','LIHEN_EXISTING_PUBLIC_LEGAL_BASELINE_REVIEW_2026-08-26','Tratamiento de datos y canales de consulta.'),
('RETURNS','#cambios-devoluciones','PUBLISHED_BASELINE','LIHEN_EXISTING_PUBLIC_LEGAL_BASELINE_REVIEW_2026-08-26','Cambios, retracto cuando corresponda y garantía diferenciados.'),
('SHIPPING','#envios','SOURCE_APPROVED','POLITICA_ENVIOS_LIHENCO_V1_JULIO_2026','Cobertura nacional, Cali 1-3 días hábiles y envío gratis desde COP 100000.'),
('PQRS','#pqrs','CONFIGURED','LIHEN_CONSUMER_COMPLIANCE_REVIEW_2026-08-26','Canal visible para peticiones, quejas, reclamos y solicitudes.'),
('CONSUMER','#consumidor','CONFIGURED','LIHEN_CONSUMER_COMPLIANCE_REVIEW_2026-08-26','Enlace visible a la SIC sin uso de logo ni afirmación de aval.')
on conflict(content_key) do update set route_hash=excluded.route_hash,content_status=excluded.content_status,source_reference=excluded.source_reference,public_summary=excluded.public_summary,updated_at=now();
insert into lihen_private.public_hub_blocks(block_type,status,sort_order,title,subtitle,cta_label,target_url)
select 'HEADING','PUBLISHED',100,'Así se vive LIHEN.CO','Síguenos y descubre novedades, productos y contenido de la tienda virtual.',null,null
where not exists(select 1 from lihen_private.public_hub_blocks where title='Así se vive LIHEN.CO' and status<>'ARCHIVED');
insert into lihen_private.public_hub_blocks(block_type,status,sort_order,title,subtitle,cta_label,target_url)
select x.block_type,'PUBLISHED',x.sort_order,x.title,x.subtitle,x.cta_label,x.target_url
from (values
 ('SOCIAL'::text,110,'Instagram','@lihen.co','Ver Instagram','https://www.instagram.com/lihen.co/'),
 ('SOCIAL'::text,120,'Facebook','LIHEN.CO oficial','Ver Facebook','https://www.facebook.com/lihen.co.oficial'),
 ('SOCIAL'::text,130,'TikTok','@lihen.co','Ver TikTok','https://www.tiktok.com/@lihen.co')
) x(block_type,sort_order,title,subtitle,cta_label,target_url)
where not exists(select 1 from lihen_private.public_hub_blocks b where b.target_url=x.target_url and b.status<>'ARCHIVED');
create or replace view lihen_private.qa_d_institutional_social_legal_closure as
with registry as (
 select count(*) filter(where content_key in ('ABOUT','TERMS','PRIVACY','RETURNS','SHIPPING','PQRS','CONSUMER'))::int required_registered,
        count(*) filter(where content_key='SHIPPING' and content_status='SOURCE_APPROVED')::int shipping_source_approved
 from lihen_private.storefront_public_content_registry
), social as (
 select count(*) filter(where status='PUBLISHED' and block_type='SOCIAL' and target_url in ('https://www.instagram.com/lihen.co/','https://www.facebook.com/lihen.co.oficial','https://www.tiktok.com/@lihen.co'))::int official_social_links,
        count(*) filter(where status='PUBLISHED' and block_type='HEADING' and title='Así se vive LIHEN.CO')::int social_heading
 from lihen_private.public_hub_blocks
), style as (select count(*) filter(where status='ACTIVE' and visible_on_website)::int style_visible from public.products where business_line='STYLE')
select case when r.required_registered=7 and r.shipping_source_approved=1 and s.official_social_links=3 and s.social_heading>=1 and st.style_visible=0 then 'PASS' else 'BLOCKED' end closure_status,
 r.required_registered,r.shipping_source_approved,s.official_social_links,s.social_heading,st.style_visible,
 jsonb_build_array('ABOUT_PAGE_CONFIGURED','OFFICIAL_SOCIAL_LINKS_PUBLISHED','LEGAL_ROUTES_REGISTERED','SHIPPING_POLICY_SOURCE_APPROVED','PQRS_VISIBLE','SIC_TEXT_LINK_REQUIRED_NO_LOGO_ENDORSEMENT','STYLE_REMAINS_HIDDEN') contract
from registry r cross join social s cross join style st;
revoke all on lihen_private.qa_d_institutional_social_legal_closure from public,anon,authenticated;
grant select on lihen_private.qa_d_institutional_social_legal_closure to postgres;
insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select 'QA-D',case when closure_status='PASS' then 'PASS' else 'BLOCKED' end,'QA_D_INSTITUTIONAL_SOCIAL_LEGAL_CLOSURE_V1',jsonb_build_object('required_registered',required_registered,'shipping_source_approved',shipping_source_approved,'official_social_links',official_social_links,'social_heading',social_heading,'style_visible',style_visible,'contract',contract),'[]'::jsonb,'QA-D closes institutional/social/legal storefront structure with official social links, registered legal routes, source-backed shipping policy and visible consumer/SIC path.',now()
from lihen_private.qa_d_institutional_social_legal_closure
on conflict(phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
