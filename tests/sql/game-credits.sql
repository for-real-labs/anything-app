\set ON_ERROR_STOP on
\ir bootstrap.sql
\ir ../../supabase/migrations/202610310001_app_anything.sql
\ir ../../supabase/migrations/202610310002_job_lock_order.sql
\ir ../../supabase/migrations/202610310003_claim_jobs.sql

-- An allowance predating this migration must survive the policy migration.
insert into auth.users(id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-000000000001', 'existing@example.com', now());
select public.ensure_app_account('00000000-0000-4000-8000-000000000001');
update public.app_accounts set unlimited = true where user_id = '00000000-0000-4000-8000-000000000001';
\ir ../../supabase/migrations/202610310004_unlimited_app_access.sql

begin;
do $$
declare
 normal_id uuid := gen_random_uuid();
 granted_id uuid := gen_random_uuid();
 unverified_id uuid := gen_random_uuid();
 future_id uuid := gen_random_uuid();
 job_id uuid;
 job public.app_jobs;
 account public.app_accounts;
 app_id uuid;
begin
 account := public.ensure_app_account('00000000-0000-4000-8000-000000000001');
 assert account.unlimited, 'Existing verified allowance was lost';
 assert exists(select 1 from public.app_unlimited_emails where email = 'jakejohnson3700@gmail.com'), 'Owner allowance was lost';

 insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data) values
 (normal_id, 'normal@example.com', now(), '{"unlimited":true,"email":"granted@example.com"}'),
 (granted_id, 'Granted@Example.com', now(), '{}'),
 (unverified_id, 'unverified@example.com', null, '{}');
 account := public.ensure_app_account(normal_id);
 assert not account.unlimited and account.credits = 10, 'Client metadata granted unlimited access';
 perform public.ensure_app_account(granted_id);
 update public.app_accounts set credits = 0 where user_id = granted_id;
 insert into public.app_unlimited_emails(email) values
 ('granted@example.com'), ('unverified@example.com'), ('future@example.com');
 account := public.ensure_app_account(granted_id);
 assert account.unlimited and account.credits = 0, 'Existing exhausted account was not upgraded without changing its balance';
 account := public.ensure_app_account(unverified_id);
 assert not account.unlimited, 'Unverified email received unlimited access';
 insert into auth.users(id, email, email_confirmed_at) values (future_id, 'future@example.com', now());
 account := public.ensure_app_account(future_id);
 assert account.unlimited, 'Allowance did not apply on first sign-in';

 -- More than the normal ten credits; include revisions and idempotent retries.
 for i in 1..12 loop
  job_id := gen_random_uuid();
  job := public.reserve_app_job(granted_id, job_id, app_id, 'test app');
  assert not job.charged, 'Unlimited generation was charged';
  assert (public.reserve_app_job(granted_id, job_id, app_id, 'test app')).id = job_id, 'Retry was not idempotent';
  perform public.complete_app_job(job_id, 'Test', '<html>test</html>');
  select j.app_id into app_id from public.app_jobs j where j.id = job_id;
 end loop;
 assert (select revision from public.created_apps where id = app_id) = 12, 'Unlimited revisions failed';
 job_id := gen_random_uuid();
 perform public.reserve_app_job(granted_id, job_id, null, 'test failure');
 begin
  perform public.reserve_app_job(granted_id, gen_random_uuid(), null, 'overlap');
  raise exception 'Unlimited user bypassed the pending-job guard';
 exception when raise_exception then
  if sqlerrm <> 'A app is already generating' then raise; end if;
 end;
 perform public.fail_app_job(job_id, 'test');
 perform public.fail_app_job(job_id, 'test');
 account := public.ensure_app_account(granted_id);
 assert account.credits = 0, 'Uncharged failure incorrectly refunded a credit';
 begin
  perform public.reserve_app_job(normal_id, gen_random_uuid(), app_id, 'another user app');
  raise exception 'Cross-account revision was allowed';
 exception when raise_exception then
  if sqlerrm <> 'App not found' then raise; end if;
 end;
 job_id := gen_random_uuid();
 job := public.reserve_app_job(normal_id, job_id, null, 'normal credit');
 assert job.charged and (public.ensure_app_account(normal_id)).credits = 9, 'Normal credit accounting changed';
 perform public.fail_app_job(job_id, 'test');
 assert (public.ensure_app_account(normal_id)).credits = 10, 'Normal refund failed';
 update public.app_accounts set credits = 0 where user_id = normal_id;
 begin
  perform public.reserve_app_job(normal_id, gen_random_uuid(), null, 'no credits');
  raise exception 'Normal exhausted account generated a app';
 exception when raise_exception then
  if sqlerrm <> 'No credits remaining' then raise; end if;
 end;
 delete from public.app_unlimited_emails where email = 'granted@example.com';
 assert not (public.ensure_app_account(granted_id)).unlimited, 'Revoked allowance remained active';
 update auth.users set email_confirmed_at = now() where id = unverified_id;
 assert (public.ensure_app_account(unverified_id)).unlimited, 'Verified email did not gain its allowance';
 update auth.users set email = 'different@example.com' where id = unverified_id;
 assert not (public.ensure_app_account(unverified_id)).unlimited, 'Allowance survived an email change';
end $$;

-- Assert the actual PostgreSQL grants and RLS boundary, not a client-side mock.
do $$
declare r text;
begin
 foreach r in array array['anon', 'authenticated'] loop
  assert not has_table_privilege(r, 'public.app_unlimited_emails', 'SELECT'), 'Client can read private allowance emails';
  assert not has_table_privilege(r, 'public.app_unlimited_emails', 'INSERT, UPDATE, DELETE'), 'Client can grant itself access';
  assert not has_function_privilege(r, 'public.ensure_app_account(uuid)', 'EXECUTE'), 'Client can invoke privileged account reconciliation';
 end loop;
 assert (select relrowsecurity from pg_class where oid = 'public.app_unlimited_emails'::regclass), 'RLS is disabled';
 assert has_table_privilege('service_role', 'public.app_unlimited_emails', 'INSERT'), 'Operator cannot manage allowances';
end $$;
rollback;
\echo 'PASS: unlimited access, verified identity, credits, revisions, revocation, and client permission boundaries'
