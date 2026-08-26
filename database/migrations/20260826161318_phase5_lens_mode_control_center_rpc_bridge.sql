create or replace function public.start_visual_intelligence_session_controlled(p_product_id uuid,p_input_asset_reference text,p_input_origin text default 'CONTROL_CENTER_UPLOAD') returns uuid
language plpgsql security definer set search_path='' as $function$
declare v_actor uuid:=auth.uid(); v_session_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception 'Active OWNER or ADMIN authorization required'; end if;
  if nullif(btrim(p_input_asset_reference),'') is null then raise exception 'input asset reference is required'; end if;
  v_session_id:=lihen_private.start_visual_intelligence_session(p_product_id,p_input_asset_reference,p_input_origin);
  return v_session_id;
end;$function$;

create or replace function public.get_visual_intelligence_session_summary_controlled(p_session_id uuid)
returns table(session_id uuid,sku_snapshot text,product_name_snapshot text,status text,identity_scope text,signal_count bigint,candidate_count bigint,best_candidate_confidence numeric,decision_status text,decided_brand text,decided_product_name text,decided_variant text,rights_status text,requires_human_review boolean,next_action text)
language plpgsql security definer set search_path='' as $function$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception 'Active OWNER or ADMIN authorization required'; end if;
  return query select s.session_id,s.sku_snapshot,s.product_name_snapshot,s.status,s.identity_scope,s.signal_count,s.candidate_count,s.best_candidate_confidence,s.decision_status,s.decided_brand,s.decided_product_name,s.decided_variant,s.rights_status,coalesce(d.requires_human_review,vs.requires_human_review),s.next_action from lihen_private.visual_intelligence_session_summary s join lihen_private.visual_intelligence_sessions vs on vs.id=s.session_id left join lihen_private.visual_intelligence_decisions d on d.session_id=s.session_id where s.session_id=p_session_id;
end;$function$;

grant execute on function public.start_visual_intelligence_session_controlled(uuid,text,text) to authenticated;
grant execute on function public.get_visual_intelligence_session_summary_controlled(uuid) to authenticated;
revoke all on function public.start_visual_intelligence_session_controlled(uuid,text,text) from anon;
revoke all on function public.get_visual_intelligence_session_summary_controlled(uuid) from anon;
