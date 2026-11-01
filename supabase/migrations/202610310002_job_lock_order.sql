-- Keep the same account -> job lock order for reservations and refunds.
create or replace function public.fail_app_job(jid uuid, reason text) returns void
language plpgsql security definer set search_path=public as $$
declare job app_jobs; uid uuid;
begin
 select user_id into uid from app_jobs where id=jid;
 perform 1 from app_accounts where user_id=uid for update;
 select * into job from app_jobs where id=jid for update;
 if job.status='pending' then
  update app_jobs set status='failed',error=reason where id=jid;
  if job.charged then update app_accounts set credits=credits+1 where user_id=job.user_id; end if;
 end if;
end $$;
