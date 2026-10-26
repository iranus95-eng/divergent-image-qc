-- Shared calculator data. Only the authenticated admin Edge Function can access it.
create table public.system_cost_records (
  key text primary key check (length(key) between 1 and 160),
  value jsonb,
  revision bigint not null default 1,
  updated_by bigint references public.app_users(id),
  updated_at timestamptz not null default now()
);
alter table public.system_cost_records enable row level security;
revoke all on public.system_cost_records from public, anon, authenticated;
grant select, insert, update on public.system_cost_records to service_role;

-- Compare-and-swap prevents two admins/tabs from silently overwriting each other.
create function public.save_system_cost_record(p_key text, p_value jsonb, p_revision bigint, p_user bigint)
returns setof public.system_cost_records
language plpgsql security invoker set search_path = '' as $$
begin
  if p_revision = 0 then
    return query insert into public.system_cost_records (key, value, updated_by)
      values (p_key, p_value, p_user) on conflict (key) do nothing returning *;
  else
    return query update public.system_cost_records set value = p_value,
      revision = revision + 1, updated_by = p_user, updated_at = now()
      where key = p_key and revision = p_revision returning *;
  end if;
end;
$$;
revoke all on function public.save_system_cost_record(text,jsonb,bigint,bigint) from public, anon, authenticated;
grant execute on function public.save_system_cost_record(text,jsonb,bigint,bigint) to service_role;
