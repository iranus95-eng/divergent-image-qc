-- applied 2026-10-04 via Supabase MCP (migration "document_archive")
create table if not exists public.document_archive (
  id bigserial primary key,
  doc_type text not null check (doc_type in ('invoice','billing','receipt')),
  doc_no text not null,
  doc_date date,
  customer_name text,
  total_amount numeric(14,2),
  state jsonb not null default '{}'::jsonb,
  html text not null,
  created_by bigint references public.app_users(id) on delete set null,
  updated_by bigint references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doc_type, doc_no)
);
create index if not exists document_archive_type_date_idx on public.document_archive (doc_type, doc_date desc, id desc);
create table if not exists public.document_archive_assets (
  hash text primary key,
  data text not null,
  created_at timestamptz not null default now()
);
alter table public.document_archive enable row level security;
alter table public.document_archive_assets enable row level security;
revoke all on public.document_archive, public.document_archive_assets from anon, authenticated;
