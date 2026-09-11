-- Additive claim register. Existing application tables and source rows are not changed.
create table public.claim_register_imports (
 source_hash text primary key, source_name text not null, source_workbook jsonb not null,
 legacy_web_snapshot jsonb not null, expected_rows integer not null,
 imported_at timestamptz not null default now()
);
create table public.claim_register_records (
 id uuid primary key default gen_random_uuid(),
 category text not null check(category in ('monthly','arrears','guarantee')),
 agency text not null check(length(trim(agency)) between 1 and 200),
 report_year integer not null check(report_year between 2400 and 2700),
 report_month integer check(report_month between 1 and 12),
 work_period text, bill_count bigint check(bill_count>=0),
 claim_cents bigint check(claim_cents between 0 and 999999999999),
 opening_received_cents bigint check(opening_received_cents between 0 and 999999999999),
 opening_fine_cents bigint check(opening_fine_cents between 0 and 999999999999),
 claim_date date, note text not null default '' check(length(note)<=4000),
 needs_review boolean not null default false,
 source_hash text references public.claim_register_imports(source_hash),
 source_sheet text, source_row integer, source_data jsonb,
 created_by bigint references public.app_users(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), revision integer not null default 1,
 unique(source_hash,source_sheet,source_row),
 check(category='guarantee' or report_month is not null),
 check(needs_review or (claim_cents is not null and opening_received_cents is not null and opening_fine_cents is not null))
);
create table public.claim_register_receipts (
 id uuid primary key default gen_random_uuid(), record_id uuid not null references public.claim_register_records(id),
 amount_cents bigint not null check(amount_cents between 0 and 999999999999),
 fine_cents bigint not null default 0 check(fine_cents between 0 and 999999999999),
 received_on date not null, note text not null default '' check(length(note)<=4000),
 attachment_path text, attachment_name text,
 created_by bigint not null references public.app_users(id),created_at timestamptz not null default now(),
 check(amount_cents+fine_cents>0)
);
create table public.claim_register_audit (
 id bigint generated always as identity primary key,
 request_id uuid not null unique, record_id uuid not null references public.claim_register_records(id),
 actor_id bigint not null references public.app_users(id), action text not null,
 before_data jsonb, after_data jsonb not null, result jsonb not null,
 created_at timestamptz not null default now()
);
create index claim_register_filter_idx on public.claim_register_records(category,report_year,report_month);
create index claim_register_receipt_idx on public.claim_register_receipts(record_id);
create index claim_register_audit_record_idx on public.claim_register_audit(record_id);
alter table public.claim_register_imports enable row level security;
alter table public.claim_register_records enable row level security;
alter table public.claim_register_receipts enable row level security;
alter table public.claim_register_audit enable row level security;
revoke all on public.claim_register_imports,public.claim_register_records,public.claim_register_receipts,public.claim_register_audit from public,anon,authenticated;
grant all on public.claim_register_imports,public.claim_register_records,public.claim_register_receipts,public.claim_register_audit to service_role;
grant usage,select on sequence public.claim_register_audit_id_seq to service_role;

-- Only the server, after validating the existing LINE/app session, can invoke writes.
create function public.claim_register_write(p_actor bigint,p_request uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 u record; r public.claim_register_records; old_data jsonb; result_data jsonb;
 old_audit public.claim_register_audit; amount bigint; fine bigint; paid bigint; fines bigint;
 receipt_id uuid; target_id uuid; k text;
begin
 select id,role,is_active,expires_at,can_access_qc into u from public.app_users where id=p_actor;
 if not found or u.is_active is not true or (u.expires_at is not null and u.expires_at<=now())
 or not (lower(u.role)='admin' or (u.can_access_qc is true and lower(u.role) in ('staff','user_creator')))
 then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
 if p_request is null then raise exception 'REQUEST_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into old_audit from public.claim_register_audit where request_id=p_request;
 if found then
   if old_audit.actor_id<>p_actor or old_audit.action<>p_action then raise exception 'REQUEST_CONFLICT'; end if;
   return old_audit.result;
 end if;
 if p_action not in ('create','update','receive','reconcile','attach') then raise exception 'UNKNOWN_ACTION'; end if;
 foreach k in array array['claim_cents','opening_received_cents','opening_fine_cents','amount_cents','fine_cents','bill_count'] loop
   if p_data ? k and (p_data->>k is null or (p_data->>k)!~'^\d+$' or (p_data->>k)::numeric>999999999999) then raise exception 'INVALID_AMOUNT'; end if;
 end loop;
 if p_action='create' then
   if coalesce((p_data->>'claim_cents')::bigint,0)<=0 or not (p_data ?& array['agency','report_year','report_month','bill_count','claim_date']) then raise exception 'MISSING_FIELDS'; end if;
   insert into public.claim_register_records(category,agency,report_year,report_month,bill_count,claim_cents,opening_received_cents,opening_fine_cents,claim_date,note,created_by)
   values('monthly',trim(p_data->>'agency'),(p_data->>'report_year')::integer,(p_data->>'report_month')::integer,(p_data->>'bill_count')::bigint,(p_data->>'claim_cents')::bigint,0,0,(p_data->>'claim_date')::date,coalesce(p_data->>'note',''),p_actor) returning * into r;
   old_data=null;result_data=jsonb_build_object('record_id',r.id);
 else
   target_id=(p_data->>'record_id')::uuid;
   select * into r from public.claim_register_records where id=target_id for update;
   if not found then raise exception 'NOT_FOUND'; end if;
   if r.category='guarantee' then raise exception 'GUARANTEE_READ_ONLY'; end if;
   old_data=to_jsonb(r);
   if p_action in ('update','reconcile') and (p_data->>'revision')::integer is distinct from r.revision then raise exception 'REVISION_CONFLICT'; end if;
   select coalesce(sum(amount_cents),0),coalesce(sum(fine_cents),0) into paid,fines from public.claim_register_receipts where record_id=r.id;
   if p_action='update' then
     if r.source_hash is not null or exists(select 1 from public.claim_register_receipts where record_id=r.id) then raise exception 'CLAIM_LOCKED'; end if;
     if coalesce((p_data->>'claim_cents')::bigint,0)<=0 or not (p_data ?& array['agency','report_year','report_month','bill_count','claim_date']) then raise exception 'MISSING_FIELDS'; end if;
     update public.claim_register_records set agency=trim(p_data->>'agency'),report_year=(p_data->>'report_year')::integer,report_month=(p_data->>'report_month')::integer,bill_count=(p_data->>'bill_count')::bigint,claim_cents=(p_data->>'claim_cents')::bigint,claim_date=(p_data->>'claim_date')::date,note=coalesce(p_data->>'note',''),revision=revision+1,updated_at=now() where id=r.id returning * into r;
   elsif p_action='reconcile' then
     if r.needs_review is not true or not(p_data ?& array['claim_cents','opening_received_cents','opening_fine_cents']) or length(trim(coalesce(p_data->>'reason','')))<3 then raise exception 'REVIEW_REQUIRED'; end if;
     if (p_data->>'claim_cents')::bigint < (p_data->>'opening_received_cents')::bigint+(p_data->>'opening_fine_cents')::bigint+paid+fines then raise exception 'AMOUNT_EXCEEDS_CLAIM'; end if;
     update public.claim_register_records set claim_cents=(p_data->>'claim_cents')::bigint,opening_received_cents=(p_data->>'opening_received_cents')::bigint,opening_fine_cents=(p_data->>'opening_fine_cents')::bigint,needs_review=false,revision=revision+1,updated_at=now() where id=r.id returning * into r;
   elsif p_action='receive' then
     if r.needs_review then raise exception 'REVIEW_REQUIRED'; end if;
     amount=(p_data->>'amount_cents')::bigint;fine=(p_data->>'fine_cents')::bigint;
     if amount is null or fine is null or amount+fine<=0 then raise exception 'INVALID_AMOUNT'; end if;
     if r.opening_received_cents+r.opening_fine_cents+paid+fines+amount+fine>r.claim_cents then raise exception 'AMOUNT_EXCEEDS_CLAIM'; end if;
     insert into public.claim_register_receipts(record_id,amount_cents,fine_cents,received_on,note,created_by)
       values(r.id,amount,fine,(p_data->>'received_on')::date,coalesce(p_data->>'note',''),p_actor) returning id into receipt_id;
     update public.claim_register_records set revision=revision+1,updated_at=now() where id=r.id returning * into r;
   elsif p_action='attach' then
     receipt_id=(p_data->>'receipt_id')::uuid;
     if (p_data->>'path') not like 'claims/'||r.id::text||'/'||receipt_id::text||'/%' or length(coalesce(p_data->>'name',''))=0 then raise exception 'INVALID_ATTACHMENT'; end if;
     update public.claim_register_receipts set attachment_path=p_data->>'path',attachment_name=p_data->>'name' where id=receipt_id and record_id=r.id and attachment_path is null;
     if not found then raise exception 'ATTACHMENT_CONFLICT'; end if;
   end if;
   result_data=jsonb_build_object('record_id',r.id,'receipt_id',receipt_id);
 end if;
 insert into public.claim_register_audit(request_id,record_id,actor_id,action,before_data,after_data,result)
 values(p_request,r.id,p_actor,p_action,old_data,jsonb_build_object('record',to_jsonb(r),'input',p_data),result_data);
 return result_data;
end $$;
revoke all on function public.claim_register_write(bigint,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_register_write(bigint,uuid,text,jsonb) to service_role;
