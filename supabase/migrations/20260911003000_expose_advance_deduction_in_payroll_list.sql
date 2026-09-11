drop function public.internal_payroll_web_list(text);

create function public.internal_payroll_web_list(p_source_month text default 'กย69')
returns table(
  id bigint,
  source_row bigint,
  source_month text,
  employee_name text,
  national_id text,
  bank_name text,
  bank_account text,
  site_name text,
  rate_per_unit numeric,
  profile_id bigint,
  is_active boolean,
  updated_at timestamptz,
  app_user_id bigint,
  national_id_last4 text,
  advance_deduction numeric
)
language sql
security definer
set search_path = ''
as $$
  select
    m.id,
    m.source_row,
    m.source_month,
    m.employee_name,
    m.national_id,
    m.bank_name,
    m.bank_account,
    m.site_name,
    m.rate_per_unit,
    m.profile_id,
    m.is_active,
    m.updated_at,
    p.app_user_id,
    right(regexp_replace(coalesce(m.national_id,''), '\D', '', 'g'), 4),
    coalesce(m.advance_deduction, 0)
  from public.payroll_master_rows m
  left join public.employee_payroll_profiles p on p.id = m.profile_id
  where m.source_month = p_source_month
    and m.is_active = true
    and m.source_row >= 1
  order by m.source_row
  limit 500;
$$;

revoke all on function public.internal_payroll_web_list(text) from public, anon, authenticated;
grant execute on function public.internal_payroll_web_list(text) to service_role;

