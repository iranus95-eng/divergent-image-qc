-- Legacy-only drafts: shared staff_payroll_rows and V2 reports are not mutated.
create table public.legacy_staff_payroll_drafts (
  like public.staff_payroll_rows including defaults including identity,
  payroll_profile_id bigint references public.employee_payroll_profiles(id),
  primary key (id),
  unique (payroll_month, source_row)
);
alter table public.legacy_staff_payroll_drafts enable row level security;
revoke all on public.legacy_staff_payroll_drafts from public, anon, authenticated;
grant all on public.legacy_staff_payroll_drafts to service_role;
grant usage, select on sequence public.legacy_staff_payroll_drafts_id_seq to service_role;

create function public.ensure_legacy_staff_payroll_month(p_month date)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_source date; v_count integer;
begin
  if p_month is null or p_month <> date_trunc('month', p_month)::date
     or p_month < date '2026-09-01' then
    raise exception 'INVALID_MONTH';
  end if;
  perform pg_advisory_xact_lock(92471, (p_month - date '2000-01-01')::integer);
  -- Never overwrite imported/entered payroll or reinsert a disabled draft.
  if exists(select 1 from public.staff_payroll_rows where payroll_month=p_month)
     or exists(select 1 from public.legacy_staff_payroll_drafts where payroll_month=p_month) then
    return 0;
  end if;
  select max(payroll_month) into v_source from (
    select payroll_month from public.staff_payroll_rows where is_active and payroll_month<p_month
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
revoke all on function public.ensure_legacy_staff_payroll_month(date) from public, anon, authenticated;
grant execute on function public.ensure_legacy_staff_payroll_month(date) to service_role;

create function public.legacy_staff_payroll_rows(p_month date)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with source as (
    select to_jsonb(s) as row_data,s.source_row,s.national_id,s.employee_name,
           s.advance_deduction,s.net_paid,false as pending,
           (select d.payroll_profile_id from public.legacy_staff_payroll_drafts d
            where d.payroll_month=s.payroll_month and d.national_id=s.national_id
            order by d.id limit 1) as profile_id
    from public.staff_payroll_rows s where s.payroll_month=p_month and s.is_active
    union all
    select to_jsonb(d)-'payroll_profile_id',d.source_row,d.national_id,d.employee_name,
           d.advance_deduction,d.net_paid,true,d.payroll_profile_id
    from public.legacy_staff_payroll_drafts d
    where d.payroll_month=p_month and d.is_active
      and not exists(select 1 from public.staff_payroll_rows s where s.payroll_month=p_month)
  ), totals as (
    -- Requests have no payroll-month field. Use their immutable request month in Bangkok,
    -- never the profile's mutable source_month or the date an old request gets approved.
    select payroll_profile_id,sum(requested_amount) amount
    from public.employee_advance_requests
    where status='APPROVED'
      and created_at >= (p_month::timestamp at time zone 'Asia/Bangkok')
      and created_at < ((p_month+interval '1 month')::timestamp at time zone 'Asia/Bangkok')
    group by payroll_profile_id
  )
  select coalesce(jsonb_agg(s.row_data || jsonb_build_object(
    'advance_deduction',case when p_month<date '2026-09-01' then s.advance_deduction else coalesce(t.amount,0) end,
    'net_paid',case when p_month<date '2026-09-01' then s.net_paid else s.net_paid+s.advance_deduction-coalesce(t.amount,0) end,
    'salary_pending',s.pending
  ) order by s.source_row),'[]'::jsonb)
  from source s left join totals t on t.payroll_profile_id=s.profile_id;
$$;
revoke all on function public.legacy_staff_payroll_rows(date) from public, anon, authenticated;
grant execute on function public.legacy_staff_payroll_rows(date) to service_role;

create extension if not exists pg_cron with schema pg_catalog;
-- Daily retry at 00:05 Bangkok. Idempotent creation occurs once per new month.
select cron.schedule('legacy-staff-payroll-monthly','5 17 * * *',
  $$select public.ensure_legacy_staff_payroll_month(date_trunc('month',now() at time zone 'Asia/Bangkok')::date);$$);
select public.ensure_legacy_staff_payroll_month(date '2026-09-01');
