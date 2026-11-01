alter table public.app_accounts add column adult_declared_at timestamptz;
create table public.app_reports (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users on delete cascade,
 app_id uuid references public.created_apps on delete set null,
 reason text not null check(length(reason) <= 2000),
 created_at timestamptz not null default now(),
 resolved_at timestamptz
);
alter table public.app_reports enable row level security;
revoke all on public.app_reports from public, anon, authenticated;
grant all on public.app_reports to service_role;
