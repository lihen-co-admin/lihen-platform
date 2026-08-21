-- FASE 1.21.5.1 re-lock after policy approval cutover
revoke execute on function public.apply_ready_candidate_approval_policy_controlled(text,uuid,text) from authenticated;
