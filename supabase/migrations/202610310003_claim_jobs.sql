-- Only one server process can spend provider tokens for a request ID.
alter table public.app_jobs add column worker_claimed boolean not null default false;
