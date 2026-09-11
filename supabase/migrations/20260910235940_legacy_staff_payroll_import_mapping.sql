create or replace function public.ensure_legacy_staff_payroll_month(p_month date)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_source date; v_count integer;
begin
  if p_month is null or p_month <> date_trunc('month', p_month)::date
     or p_month < date '2026-09-01' then
    raise exception 'INVALID_MONTH';
  end if;
  perform pg_advisory_xact_lock(92471, (p_month - date '2000-01-01')::integer);
  -- Never overwrite imported/entered payroll or reinsert a disabled draft.
  if exists(select 1 from public.legacy_staff_payroll_drafts where payroll_month=p_month) then
    return 0;
  end if;
  select max(payroll_month) into v_source from (
    select payroll_month from public.staff_payroll_rows where is_active and payroll_month<=p_month
    union all
    select payroll_month from public.legacy_staff_payroll_drafts where is_active and payroll_month<p_month
  ) m;
  if v_source is null then raise exception 'STAFF_PAYROLL_TEMPLATE_MISSING'; end if;
  with roster as (
    select source_row,national_id,employee_name,bank_name,bank_account,start_date_text,
           null::bigint as payroll_profile_id
    from public.staff_payroll_rows where payroll_month=v_source and is_active
    union all
    select source_row,national_id,employee_name,bank_name,bank_account,start_date_text,payroll_profile_id
    from public.legacy_staff_payroll_drafts d where payroll_month=v_source and is_active
      and not exists(select 1 from public.staff_payroll_rows where payroll_month=v_source)
  )
  insert into public.legacy_staff_payroll_drafts
    (payroll_month,source_row,national_id,employee_name,bank_name,bank_account,start_date_text,
     payroll_profile_id,note,source_file)
  select p_month,r.source_row,r.national_id,r.employee_name,r.bank_name,r.bank_account,r.start_date_text,
    coalesce(r.payroll_profile_id, case when p.n=1 then p.id end),
    'รอกรอกเงินเดือนหลังเสร็จงาน','LEGACY_MONTHLY_DRAFT'
  from roster r
  left join lateral (
    select count(*) n,min(ep.id) id from public.employee_payroll_profiles ep
    where ep.is_active and (
      (nullif(ep.national_id,'') is not null and
       regexp_replace(ep.national_id,'[^0-9]','','g')=regexp_replace(r.national_id,'[^0-9]','','g'))
      or (nullif(ep.national_id,'') is null and
          regexp_replace(ep.employee_name,'\s+','','g')=regexp_replace(r.employee_name,'\s+','','g')
          and (select count(*) from roster x where regexp_replace(x.employee_name,'\s+','','g')=
               regexp_replace(r.employee_name,'\s+','','g'))=1)
    )
  ) p on true;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
