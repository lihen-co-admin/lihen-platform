-- H5 — Auth/RLS least-privilege hardening.
-- These SECURITY DEFINER RPCs already enforce authenticated ACTIVE OWNER/ADMIN.
-- Remove the implicit PUBLIC EXECUTE privilege while preserving authenticated access.

revoke execute on function
  public.start_visual_intelligence_session_controlled(uuid,text,text)
from public;

revoke execute on function
  public.get_visual_intelligence_session_summary_controlled(uuid)
from public;

grant execute on function
  public.start_visual_intelligence_session_controlled(uuid,text,text)
to authenticated;

grant execute on function
  public.get_visual_intelligence_session_summary_controlled(uuid)
to authenticated;
