-- Security Advisor fix: the balance view must execute with caller permissions/RLS.
create or replace view public.financial_account_balances with (security_invoker=true) as
select a.id as account_id,a.code,a.name,a.account_type,a.currency,a.status,
       coalesce(sum(m.amount_signed),0::numeric) as balance
from public.financial_accounts a
left join public.financial_movements m on m.account_id=a.id
group by a.id,a.code,a.name,a.account_type,a.currency,a.status;
revoke all on public.financial_account_balances from anon,authenticated;
grant select on public.financial_account_balances to authenticated;
