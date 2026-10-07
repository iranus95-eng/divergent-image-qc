-- Payroll batches (รอบเงินเดือน) per month.
-- A month's batch closes when the 4th of the next month starts (Bangkok time):
-- pay is settled by the 3rd, and cash advances from the 4th onward (usually around the 7th)
-- belong to the new month's batch.

create table if not exists public.payroll_master_rows_backup_20261007 as
  select * from public.payroll_master_rows;
revoke all on public.payroll_master_rows_backup_20261007 from public, anon, authenticated;
alter table public.payroll_master_rows_backup_20261007 enable row level security;

create table if not exists public.payroll_periods(
  source_month text primary key,
  period_month date not null unique check (period_month = date_trunc('month', period_month)::date),
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  starts_at timestamptz not null,   -- advances requested at/after this time belong to this batch
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  copied_from text,
  copied_rows integer
);
alter table public.payroll_periods enable row level security;
revoke all on public.payroll_periods from public, anon, authenticated;

create or replace function public.payroll_month_code(p_month date)
returns text language sql immutable set search_path = '' as $$
  select (array['มค','กพ','มีค','เมย','พค','มิย','กค','สค','กย','ตค','พย','ธค'])[extract(month from p_month)::int]
         || lpad(((extract(year from p_month)::int + 543) % 100)::text, 2, '0');
$$;

insert into public.payroll_periods(source_month, period_month, status, starts_at, opened_at, closed_at)
values ('กย69', date '2026-09-01', 'CLOSED', timestamptz '2026-09-04 00:00+07', timestamptz '2026-09-04 00:00+07', timestamptz '2026-10-04 00:00+07')
on conflict (source_month) do nothing;

-- Make sure the batch for "now" exists: from the 4th of a month it is that month, before it the previous month.
-- Creating a batch copies the roster (people, sites, rates, bank) of the latest batch with no work, specials or deductions,
-- and closes the older batches.
create or replace function public.payroll_ensure_current_period()
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamp := now() at time zone 'Asia/Bangkok';
  v_target date;
  v_code text;
  v_src text;
  v_n integer;
begin
  v_target := date_trunc('month', v_now)::date;
  if extract(day from v_now) < 4 then v_target := (v_target - interval '1 month')::date; end if;

  select source_month into v_code from public.payroll_periods where period_month = v_target;
  if v_code is not null then return v_code; end if;

  perform pg_advisory_xact_lock(92472, 1);
  select source_month into v_code from public.payroll_periods where period_month = v_target;
  if v_code is not null then return v_code; end if;

  select source_month into v_src from public.payroll_periods where period_month < v_target order by period_month desc limit 1;
  if v_src is null then raise exception 'PAYROLL_TEMPLATE_MISSING'; end if;
  v_code := public.payroll_month_code(v_target);

  insert into public.payroll_master_rows(
    source_month, source_row, line_no, profile_id, employee_name, national_id, bank_name, bank_account,
    site_name, address, rate_per_unit, notes, work_count, special_amount, advance_deduction, shirt_cost,
    is_active, created_at, updated_at)
  select v_code, source_row, line_no, profile_id, employee_name, national_id, bank_name, bank_account,
         site_name, address, rate_per_unit, notes, null, 0, 0, 0, true, now(), now()
    from public.payroll_master_rows
   where source_month = v_src and is_active = true and source_row >= 1
   order by source_row, id;
  get diagnostics v_n = row_count;

  update public.payroll_periods set status = 'CLOSED', closed_at = coalesce(closed_at, now())
   where status = 'OPEN' and period_month < v_target;

  insert into public.payroll_periods(source_month, period_month, status, starts_at, copied_from, copied_rows)
  values (v_code, v_target, 'OPEN', ((v_target + 3)::timestamp at time zone 'Asia/Bangkok'), v_src, v_n);

  insert into public.payroll_change_log(changed_by_user_id, payroll_profile_id, action, field_name, old_value, new_value, note)
  values (null, null, 'PAYROLL_PERIOD_OPENED', 'source_month', jsonb_build_object('closed', v_src),
          jsonb_build_object('opened', v_code, 'rows', v_n), 'Closed previous payroll batch and opened a new one (after the 3rd)');
  return v_code;
end;
$$;
revoke all on function public.payroll_ensure_current_period() from public, anon, authenticated;
grant execute on function public.payroll_ensure_current_period() to service_role;

create or replace function public.payroll_current_month()
returns text language sql security definer set search_path = '' as $$
  select public.payroll_ensure_current_period();
$$;
revoke all on function public.payroll_current_month() from public, anon, authenticated;
grant execute on function public.payroll_current_month() to service_role;

create or replace function public.payroll_month_is_open(p_source_month text)
returns boolean language sql stable set search_path = '' as $$
  select exists(select 1 from public.payroll_periods where source_month = p_source_month and status = 'OPEN');
$$;

-- Deductions: in a closed batch they may not exceed income (unchanged rule).
-- In the open batch work is still being entered, so an advance is recorded even before any work exists;
-- whatever does not fit the income goes on the employee's first row.
create or replace function public.payroll_rebalance_employee_deductions(p_profile_id bigint, p_source_month text, p_advance numeric, p_shirt numeric)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_advance numeric := greatest(coalesce(p_advance,0),0);
  v_shirt numeric := greatest(coalesce(p_shirt,0),0);
  v_open boolean := public.payroll_month_is_open(p_source_month);
  v_total_available numeric := 0;
  v_remaining numeric;
  v_available numeric;
  v_apply numeric;
  v_first bigint;
  r record;
begin
  select coalesce(sum(greatest(coalesce(gross_amount,0) + coalesce(special_amount,0) - coalesce(withholding_amount,0),0)),0)
    into v_total_available
    from public.payroll_master_rows
   where profile_id = p_profile_id and source_month = p_source_month and is_active = true;

  if not v_open and v_advance + v_shirt > v_total_available + 0.005 then
    raise exception 'DEDUCTIONS_EXCEED_INCOME';
  end if;

  select id into v_first from public.payroll_master_rows
   where profile_id = p_profile_id and source_month = p_source_month and is_active = true
   order by case when coalesce(gross_amount,0) > 0 then 0 else 1 end, source_row nulls last, id
   limit 1;

  update public.payroll_master_rows set advance_deduction = 0, shirt_cost = 0, updated_at = now()
   where profile_id = p_profile_id and source_month = p_source_month and is_active = true;

  v_remaining := v_advance;
  for r in
    select id, greatest(coalesce(gross_amount,0) + coalesce(special_amount,0) - coalesce(withholding_amount,0),0) as available
      from public.payroll_master_rows
     where profile_id = p_profile_id and source_month = p_source_month and is_active = true
     order by case when coalesce(gross_amount,0) > 0 then 0 else 1 end, source_row nulls last, id
  loop
    exit when v_remaining <= 0.005;
    v_available := greatest(coalesce(r.available,0),0);
    v_apply := least(v_remaining, v_available);
    if v_apply > 0 then
      update public.payroll_master_rows set advance_deduction = v_apply, updated_at = now() where id = r.id;
      v_remaining := v_remaining - v_apply;
    end if;
  end loop;
  if v_remaining > 0.005 and v_first is not null then
    update public.payroll_master_rows set advance_deduction = coalesce(advance_deduction,0) + v_remaining, updated_at = now() where id = v_first;
  end if;

  v_remaining := v_shirt;
  for r in
    select id, greatest(coalesce(gross_amount,0) + coalesce(special_amount,0) - coalesce(withholding_amount,0) - coalesce(advance_deduction,0),0) as available
      from public.payroll_master_rows
     where profile_id = p_profile_id and source_month = p_source_month and is_active = true
     order by case when coalesce(gross_amount,0) > 0 then 0 else 1 end, source_row nulls last, id
  loop
    exit when v_remaining <= 0.005;
    v_available := greatest(coalesce(r.available,0),0);
    v_apply := least(v_remaining, v_available);
    if v_apply > 0 then
      update public.payroll_master_rows set shirt_cost = v_apply, updated_at = now() where id = r.id;
      v_remaining := v_remaining - v_apply;
    end if;
  end loop;
  if v_remaining > 0.005 and v_first is not null then
    update public.payroll_master_rows set shirt_cost = coalesce(shirt_cost,0) + v_remaining, updated_at = now() where id = v_first;
  end if;

  return jsonb_build_object('ok', true, 'profile_id', p_profile_id, 'source_month', p_source_month,
    'advance_applied', v_advance, 'shirt_applied', v_shirt, 'available_income', v_total_available);
end;
$$;

-- Approving an advance adds it to the employee's row in the current (open) batch.
create or replace function public.approve_employee_advance_atomic(p_request_id bigint, p_approver_user_id bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_req public.employee_advance_requests%rowtype;
  v_month text;
  v_payroll_id bigint;
  v_before numeric;
  v_new_advance numeric;
begin
  select * into v_req from public.employee_advance_requests where id = p_request_id for update;
  if not found then raise exception 'ADVANCE_REQUEST_NOT_FOUND'; end if;

  v_month := public.payroll_current_month();

  if v_req.status = 'APPROVED' then
    select coalesce(sum(advance_deduction),0) into v_new_advance from public.payroll_master_rows
     where profile_id = v_req.payroll_profile_id and source_month = v_month and is_active = true;
    return jsonb_build_object('ok', true, 'already_approved', true, 'request_id', v_req.id,
      'requested_amount', v_req.requested_amount, 'source_month', v_month, 'advance_deduction', v_new_advance);
  end if;
  if v_req.status <> 'PENDING' then raise exception 'ADVANCE_REQUEST_NOT_PENDING'; end if;

  perform 1 from public.employee_payroll_profiles where id = v_req.payroll_profile_id and is_active = true;
  if not found then raise exception 'PAYROLL_PROFILE_NOT_FOUND'; end if;

  select id into v_payroll_id from public.payroll_master_rows
   where profile_id = v_req.payroll_profile_id and source_month = v_month and is_active = true
   order by case when coalesce(gross_amount,0) > 0 then 0 else 1 end, source_row nulls last, id
   limit 1 for update;
  if v_payroll_id is null then raise exception 'CURRENT_PAYROLL_ROW_NOT_FOUND'; end if;

  select coalesce(sum(advance_deduction),0) into v_before from public.payroll_master_rows
   where profile_id = v_req.payroll_profile_id and source_month = v_month and is_active = true;
  v_new_advance := v_before + v_req.requested_amount;

  -- the rebalance trigger spreads this employee total over their rows in the batch
  update public.payroll_master_rows set advance_deduction = v_new_advance, updated_at = now() where id = v_payroll_id;

  update public.employee_advance_requests set status = 'APPROVED', approved_at = now(), approved_by = p_approver_user_id
   where id = v_req.id;

  insert into public.payroll_change_log(changed_by_user_id, payroll_profile_id, action, field_name, old_value, new_value, note)
  values (p_approver_user_id, v_req.payroll_profile_id, 'EMPLOYEE_ADVANCE_APPROVED', 'advance_deduction',
    jsonb_build_object('before', v_before, 'source_month', v_month),
    jsonb_build_object('after', v_new_advance, 'request_id', v_req.id, 'request_code', v_req.request_code, 'amount', v_req.requested_amount, 'source_month', v_month),
    'Approved employee cash advance and synced to payroll');

  return jsonb_build_object('ok', true, 'already_approved', false, 'request_id', v_req.id, 'request_code', v_req.request_code,
    'requested_amount', v_req.requested_amount, 'payroll_row_id', v_payroll_id, 'source_month', v_month, 'advance_deduction', v_new_advance);
end;
$$;

-- Deleting an approved advance takes it back out of the open batch.
-- Advances that belong to a closed batch are not touched there (that pay is settled).
create or replace function public.delete_employee_advance_atomic(p_request_id bigint, p_user_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_req public.employee_advance_requests%rowtype;
  v_month text;
  v_start timestamptz;
  v_row bigint;
  v_before numeric;
  v_after numeric;
  v_reversed boolean := false;
begin
  select * into v_req from public.employee_advance_requests where id = p_request_id for update;
  if not found then return null; end if;

  if v_req.status = 'APPROVED' and v_req.payroll_profile_id is not null then
    v_month := public.payroll_current_month();
    select starts_at into v_start from public.payroll_periods where source_month = v_month;
    if v_req.created_at >= v_start then
      select id into v_row from public.payroll_master_rows
       where profile_id = v_req.payroll_profile_id and source_month = v_month and is_active = true
       order by case when coalesce(gross_amount,0) > 0 then 0 else 1 end, source_row nulls last, id
       limit 1 for update;
      if v_row is not null then
        select coalesce(sum(advance_deduction),0) into v_before from public.payroll_master_rows
         where profile_id = v_req.payroll_profile_id and source_month = v_month and is_active = true;
        v_after := greatest(0, round(v_before - coalesce(v_req.requested_amount,0), 2));
        update public.payroll_master_rows set advance_deduction = v_after, updated_at = now() where id = v_row;
        v_reversed := true;
      end if;
    end if;
  end if;

  delete from public.employee_advance_requests where id = v_req.id;

  insert into public.payroll_change_log(changed_by_user_id, payroll_profile_id, action, field_name, old_value, new_value, note)
  values (p_user_id, v_req.payroll_profile_id, 'EMPLOYEE_ADVANCE_DELETED', 'advance_deduction',
    jsonb_build_object('request', to_jsonb(v_req), 'before', v_before),
    jsonb_build_object('after', v_after, 'payroll_row_id', v_row, 'reversed', v_reversed, 'source_month', v_month),
    'Deleted employee cash advance request from web');

  return jsonb_build_object('request_id', v_req.id, 'status', v_req.status, 'requested_amount', v_req.requested_amount,
    'payroll_reversed', v_reversed, 'payroll_row_id', v_row, 'advance_deduction', v_after, 'source_month', v_month);
end;
$$;
revoke all on function public.delete_employee_advance_atomic(bigint,bigint) from public, anon, authenticated;
grant execute on function public.delete_employee_advance_atomic(bigint,bigint) to service_role;

-- New employees go into the open batch; profile edits update the open batch only.
create or replace function public.sync_manual_payroll_profile_to_master()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  next_row integer;
  existing_nid text;
  new_nid text;
  v_month text;
begin
  if coalesce(new.source_month,'') <> 'MANUAL' then return new; end if;
  v_month := public.payroll_current_month();
  new_nid := regexp_replace(coalesce(new.national_id,''),'\D','','g');

  if exists (select 1 from public.payroll_master_rows where profile_id = new.id and source_month = v_month) then
    select national_id into existing_nid from public.payroll_master_rows where profile_id = new.id and source_month = v_month limit 1;
    update public.payroll_master_rows
       set employee_name = new.employee_name, bank_name = new.bank_name, bank_account = new.bank_account,
           site_name = new.site_name, rate_per_unit = new.rate_per_unit, is_active = new.is_active,
           national_id = case
             when length(regexp_replace(coalesce(existing_nid,''),'\D','','g')) = 13 then existing_nid
             when length(new_nid) = 13 then new_nid
             when new.national_id_last4 is not null then '*********'||new.national_id_last4
             else existing_nid end,
           updated_at = now()
     where profile_id = new.id and source_month = v_month;
  elsif tg_op = 'INSERT' then
    select coalesce(max(source_row),0)+1 into next_row from public.payroll_master_rows where source_month = v_month;
    insert into public.payroll_master_rows(source_month,source_row,profile_id,employee_name,national_id,
      bank_name,bank_account,site_name,rate_per_unit,is_active,updated_at)
    values (v_month,next_row,new.id,new.employee_name,
      case when length(new_nid)=13 then new.national_id
           when new.national_id_last4 is not null then '*********'||new.national_id_last4 else null end,
      new.bank_name,new.bank_account,new.site_name,new.rate_per_unit,new.is_active,now());
  end if;
  return new;
end;
$$;

create or replace function public.internal_payroll_web_list(p_source_month text default null)
returns table(id bigint, source_row bigint, source_month text, employee_name text, national_id text, bank_name text,
  bank_account text, site_name text, rate_per_unit numeric, profile_id bigint, is_active boolean, updated_at timestamptz,
  app_user_id bigint, national_id_last4 text, advance_deduction numeric)
language sql security definer set search_path = '' as $$
  select m.id, m.source_row, m.source_month, m.employee_name, m.national_id, m.bank_name, m.bank_account, m.site_name,
         m.rate_per_unit, m.profile_id, m.is_active, m.updated_at, p.app_user_id,
         right(regexp_replace(coalesce(m.national_id,''), '\D', '', 'g'), 4), coalesce(m.advance_deduction, 0)
    from public.payroll_master_rows m
    left join public.employee_payroll_profiles p on p.id = m.profile_id
   where m.source_month = coalesce(p_source_month, public.payroll_current_month())
     and m.is_active = true and m.source_row >= 1
   order by m.source_row
   limit 500;
$$;
revoke all on function public.internal_payroll_web_list(text) from public, anon, authenticated;
grant execute on function public.internal_payroll_web_list(text) to service_role;

-- Open the new batch automatically just after midnight on the 4th (Bangkok).
select cron.schedule('payroll-open-new-period', '5 17 * * *', $$select public.payroll_ensure_current_period()$$);
