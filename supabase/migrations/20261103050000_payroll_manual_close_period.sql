-- ปุ่มปิดรอบเงินเดือน (manual close).
-- Closing keeps the closed batch exactly as it is (read-only history, still selectable in the month list)
-- and opens the next month's batch as a blank form: the same roster (people, sites, rates, bank)
-- with no work count, special pay or deductions.
-- Approved advances from the moment of closing go to the new batch (starts_at = now()).

-- A batch opened early by the close button stays the current batch until the calendar catches up.
create or replace function public.payroll_ensure_current_period()
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamp := now() at time zone 'Asia/Bangkok';
  v_target date := date_trunc('month', now() at time zone 'Asia/Bangkok')::date;
  v_code text; v_src text; v_n integer;
begin
  if extract(day from v_now) < 4 then v_target := (v_target - interval '1 month')::date; end if;
  select source_month into v_code from public.payroll_periods
   where status = 'OPEN' and period_month >= v_target order by period_month desc limit 1;
  if v_code is not null then return v_code; end if;
  select source_month into v_code from public.payroll_periods where period_month = v_target;
  if v_code is not null then return v_code; end if;
  perform pg_advisory_xact_lock(92472, 1);
  select source_month into v_code from public.payroll_periods
   where status = 'OPEN' and period_month >= v_target order by period_month desc limit 1;
  if v_code is not null then return v_code; end if;
  select source_month into v_code from public.payroll_periods where period_month = v_target;
  if v_code is not null then return v_code; end if;
  select source_month into v_src from public.payroll_periods where period_month < v_target order by period_month desc limit 1;
  if v_src is null then raise exception 'PAYROLL_TEMPLATE_MISSING'; end if;
  v_code := public.payroll_month_code(v_target);

  -- open the new period first so deductions in it are allowed before work is entered
  update public.payroll_periods set status = 'CLOSED', closed_at = coalesce(closed_at, now()) where status = 'OPEN' and period_month < v_target;
  insert into public.payroll_periods(source_month, period_month, status, starts_at, copied_from)
  values (v_code, v_target, 'OPEN', ((v_target + 3)::timestamp at time zone 'Asia/Bangkok'), v_src);

  insert into public.payroll_master_rows(source_month, source_row, line_no, profile_id, employee_name, national_id, bank_name, bank_account,
    site_name, address, rate_per_unit, notes, work_count, special_amount, advance_deduction, shirt_cost, is_active, created_at, updated_at)
  select v_code, source_row, line_no, profile_id, employee_name, national_id, bank_name, bank_account,
         site_name, address, rate_per_unit, notes, null, 0, 0, 0, true, now(), now()
    from public.payroll_master_rows
   where source_month = v_src and is_active = true and source_row >= 1
   order by source_row, id;
  get diagnostics v_n = row_count;
  update public.payroll_periods set copied_rows = v_n where source_month = v_code;

  insert into public.payroll_change_log(changed_by_user_id, payroll_profile_id, action, field_name, old_value, new_value, note)
  values (null, null, 'PAYROLL_PERIOD_OPENED', 'source_month', jsonb_build_object('closed', v_src),
          jsonb_build_object('opened', v_code, 'rows', v_n), 'Closed previous payroll batch and opened a new one (after the 3rd)');
  return v_code;
end;
$$;
revoke all on function public.payroll_ensure_current_period() from public, anon, authenticated;
grant execute on function public.payroll_ensure_current_period() to service_role;

-- Close the open batch now and open the next month's batch as a blank form.
-- p_expected_month guards against closing a batch other than the one the user was looking at.
-- At most one month ahead of the calendar month, so a repeated click cannot run far ahead.
create or replace function public.payroll_close_current_period(p_user_id bigint, p_expected_month text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cur text;
  v_period public.payroll_periods%rowtype;
  v_next date;
  v_code text;
  v_n integer;
  v_limit date := (date_trunc('month', now() at time zone 'Asia/Bangkok') + interval '1 month')::date;
begin
  perform pg_advisory_xact_lock(92472, 1);
  v_cur := public.payroll_ensure_current_period();
  select * into v_period from public.payroll_periods where source_month = v_cur for update;
  if not found or v_period.status <> 'OPEN' then raise exception 'PAYROLL_PERIOD_NOT_OPEN'; end if;
  if coalesce(p_expected_month, '') <> '' and p_expected_month <> v_cur then raise exception 'PAYROLL_PERIOD_CHANGED'; end if;

  v_next := (v_period.period_month + interval '1 month')::date;
  if v_next > v_limit then raise exception 'PAYROLL_NEXT_PERIOD_TOO_EARLY'; end if;
  if exists (select 1 from public.payroll_periods where period_month = v_next) then raise exception 'PAYROLL_NEXT_PERIOD_EXISTS'; end if;
  v_code := public.payroll_month_code(v_next);

  update public.payroll_periods set status = 'CLOSED', closed_at = now() where source_month = v_cur;
  insert into public.payroll_periods(source_month, period_month, status, starts_at, copied_from)
  values (v_code, v_next, 'OPEN', now(), v_cur);

  insert into public.payroll_master_rows(source_month, source_row, line_no, profile_id, employee_name, national_id, bank_name, bank_account,
    site_name, address, rate_per_unit, notes, work_count, special_amount, advance_deduction, shirt_cost, is_active, created_at, updated_at)
  select v_code, source_row, line_no, profile_id, employee_name, national_id, bank_name, bank_account,
         site_name, address, rate_per_unit, notes, null, 0, 0, 0, true, now(), now()
    from public.payroll_master_rows
   where source_month = v_cur and is_active = true and source_row >= 1
   order by source_row, id;
  get diagnostics v_n = row_count;
  update public.payroll_periods set copied_rows = v_n where source_month = v_code;

  insert into public.payroll_change_log(changed_by_user_id, payroll_profile_id, action, field_name, old_value, new_value, note)
  values (p_user_id, null, 'PAYROLL_PERIOD_CLOSED_MANUAL', 'source_month', jsonb_build_object('closed', v_cur),
          jsonb_build_object('opened', v_code, 'rows', v_n), 'Closed payroll batch from the web and opened a blank one');

  return jsonb_build_object('ok', true, 'closed', v_cur, 'opened', v_code, 'rows', v_n);
end;
$$;
revoke all on function public.payroll_close_current_period(bigint, text) from public, anon, authenticated;
grant execute on function public.payroll_close_current_period(bigint, text) to service_role;
