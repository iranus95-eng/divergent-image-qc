-- Integration checks against the current two approved September fixtures.
-- All mutations are rolled back; no notifications or approval endpoints are called.
begin;
do $$
declare rows jsonb; n integer; profile bigint; target_row integer; before_old jsonb;
begin
  select jsonb_agg(to_jsonb(s) order by s.id) into before_old from public.staff_payroll_rows s;
  rows:=public.staff_payroll_report_rows('2026-09-01');
  if (select sum((x->>'advance_deduction')::numeric) from jsonb_array_elements(rows) x)<>202.98 then
    raise exception 'baseline total'; end if;
  select d.source_row into target_row from public.staff_payroll_monthly_drafts d
    join public.employee_advance_requests a on a.payroll_profile_id=d.payroll_profile_id
    where d.payroll_month='2026-09-01' and a.status='APPROVED' and a.requested_amount=182.98 limit 1;
  if not exists(select 1 from jsonb_array_elements(rows) x where (x->>'source_row')::integer=target_row
      and (x->>'advance_deduction')::numeric=182.98 and (x->>'net_paid')::numeric=-182.98) then
    raise exception 'wrong employee'; end if;
  select d.payroll_profile_id,d.source_row into profile,target_row from public.staff_payroll_monthly_drafts d
    join public.employee_advance_requests a on a.payroll_profile_id=d.payroll_profile_id
    where d.payroll_month='2026-09-01' and a.status='APPROVED' and a.requested_amount=20 limit 1;
  update public.employee_advance_requests set payroll_profile_id=profile
    where status='APPROVED' and created_at>='2026-09-01' and created_at<'2026-10-01';
  rows:=public.staff_payroll_report_rows('2026-09-01');
  if not exists(select 1 from jsonb_array_elements(rows) x where (x->>'source_row')::integer=target_row
      and (x->>'advance_deduction')::numeric=202.98) then raise exception 'multiple requests not summed'; end if;
  update public.employee_advance_requests set status='REJECTED' where requested_amount=182.98 and payroll_profile_id=profile;
  rows:=public.staff_payroll_report_rows('2026-09-01');
  if (select sum((x->>'advance_deduction')::numeric) from jsonb_array_elements(rows) x)<>20 then
    raise exception 'rejected included'; end if;
  update public.employee_advance_requests set status='PENDING' where requested_amount=182.98 and payroll_profile_id=profile;
  rows:=public.staff_payroll_report_rows('2026-09-01');
  if (select sum((x->>'advance_deduction')::numeric) from jsonb_array_elements(rows) x)<>20 then
    raise exception 'pending included'; end if;
  update public.staff_payroll_monthly_drafts set net_paid=12345.67,advance_deduction=10,
    base_salary=14000,social_security=500,tax_3_percent=420,special_ot=100,other_deduction=824.33
    where payroll_month='2026-09-01' and payroll_profile_id=profile;
  rows:=public.staff_payroll_report_rows('2026-09-01');
  if not exists(select 1 from jsonb_array_elements(rows) x where (x->>'source_row')::integer=target_row
      and (x->>'net_paid')::numeric=12335.67 and (x->>'base_salary')::numeric=14000
      and (x->>'social_security')::numeric=500 and (x->>'tax_3_percent')::numeric=420
      and (x->>'special_ot')::numeric=100 and (x->>'other_deduction')::numeric=824.33) then
    raise exception 'other formulas changed'; end if;
  if rows<>public.staff_payroll_report_rows('2026-09-01') then raise exception 'double deduction'; end if;
  update public.employee_advance_requests set created_at='2026-08-31 16:59:59+00'
    where payroll_profile_id=profile and status='APPROVED';
  rows:=public.staff_payroll_report_rows('2026-09-01');
  if (select sum((x->>'advance_deduction')::numeric) from jsonb_array_elements(rows) x)<>0 then
    raise exception 'previous Bangkok month included'; end if;
  update public.employee_advance_requests set created_at='2026-08-31 17:00:00+00'
    where payroll_profile_id=profile and status='APPROVED';
  rows:=public.staff_payroll_report_rows('2026-09-01');
  if (select sum((x->>'advance_deduction')::numeric) from jsonb_array_elements(rows) x)<>20 then
    raise exception 'Bangkok month start excluded'; end if;
  n:=public.ensure_staff_payroll_month('2026-10-01');
  if n<>4 then raise exception 'new month roster missing'; end if;
  if public.ensure_staff_payroll_month('2026-10-01')<>0 then raise exception 'duplicate month'; end if;
  rows:=public.staff_payroll_report_rows('2026-10-01');
  if exists(select 1 from jsonb_array_elements(rows) x where (x->>'advance_deduction')::numeric<>0
      or (x->>'base_salary')::numeric<>0 or (x->>'net_paid')::numeric<>0) then
    raise exception 'previous month money carried forward'; end if;
  if before_old<>(select jsonb_agg(to_jsonb(s) order by s.id) from public.staff_payroll_rows s) then
    raise exception 'shared payroll modified'; end if;
  -- Importing real salary replaces drafts without dropping the approved deduction.
  insert into public.staff_payroll_rows
    (payroll_month,source_row,national_id,employee_name,base_salary,net_paid)
    select payroll_month,source_row,national_id,employee_name,10000,9500
    from public.staff_payroll_monthly_drafts where payroll_month='2026-09-01';
  rows:=public.staff_payroll_report_rows('2026-09-01');
  if jsonb_array_length(rows)<>4 or not exists(select 1 from jsonb_array_elements(rows) x
    where (x->>'source_row')::integer=target_row and (x->>'net_paid')::numeric=9480
    and (x->>'salary_pending')::boolean=false) then raise exception 'import replacement failed'; end if;
  -- Also support payroll entered before the monthly job runs.
  insert into public.staff_payroll_rows
    (payroll_month,source_row,national_id,employee_name,base_salary,net_paid)
    select date '2026-11-01',source_row,national_id,employee_name,10000,9500
    from public.staff_payroll_monthly_drafts where payroll_month='2026-09-01';
  if public.ensure_staff_payroll_month('2026-11-01')<>4 then
    raise exception 'preexisting payroll identity mapping missing'; end if;
  if has_function_privilege('anon','public.staff_payroll_report_rows(date)','execute')
     or has_table_privilege('authenticated','public.staff_payroll_monthly_drafts','select') then
    raise exception 'unauthorized access'; end if;
end $$;
set local role service_role;
select public.staff_payroll_report_rows('2026-09-01') is not null as service_role_can_read;
rollback;
select 'PASS: total, employee, multiple requests, status, month boundary, net, idempotency, monthly drafts, shared-data isolation, permissions' result;

