create table public.app_accounts (
 user_id uuid primary key references auth.users on delete cascade,
 credits integer not null default 10 check (credits >= 0),
 unlimited boolean not null default false
);
create table public.created_apps (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users on delete cascade,
 title text not null, html text not null,
 saved boolean not null default false,
 revision integer not null default 1,
 updated_at timestamptz not null default now()
);
create table public.app_jobs (
 id uuid primary key,
 user_id uuid not null references auth.users on delete cascade,
 app_id uuid references public.created_apps on delete cascade,
 prompt text not null,
 status text not null default 'pending' check(status in ('pending','complete','failed')),
 charged boolean not null default true,
 error text,
 created_at timestamptz not null default now()
);
alter table public.app_accounts enable row level security;
alter table public.created_apps enable row level security;
alter table public.app_jobs enable row level security;
create policy own_account on public.app_accounts for select to authenticated using (user_id=auth.uid());
create policy own_apps on public.created_apps for select to authenticated using (user_id=auth.uid());
create policy own_jobs on public.app_jobs for select to authenticated using (user_id=auth.uid());
-- All mutations go through the authenticated backend. Never trust client credit or owner fields.
revoke all on public.app_accounts,public.created_apps,public.app_jobs from anon,authenticated;
grant select on public.app_accounts,public.created_apps,public.app_jobs to authenticated;
grant all on public.app_accounts,public.created_apps,public.app_jobs to service_role;
create function public.ensure_app_account(uid uuid) returns public.app_accounts
language plpgsql security definer set search_path=public as $$
declare result public.app_accounts;
begin
 insert into app_accounts(user_id,unlimited)
 select id, false
 from auth.users where id=uid on conflict do nothing;
 select * into result from app_accounts where user_id=uid;
 return result;
end $$;
create function public.fail_app_job(jid uuid, reason text) returns void
language plpgsql security definer set search_path=public as $$
declare job app_jobs;
begin
 select * into job from app_jobs where id=jid for update;
 if job.status='pending' then
  update app_jobs set status='failed',error=reason where id=jid;
  if job.charged then update app_accounts set credits=credits+1 where user_id=job.user_id; end if;
 end if;
end $$;
create function public.reserve_app_job(uid uuid,jid uuid,gid uuid,instruction text) returns public.app_jobs
language plpgsql security definer set search_path=public as $$
declare account app_accounts; job app_jobs; stale record;
begin
 perform ensure_app_account(uid);
 select * into account from app_accounts where user_id=uid for update;
 for stale in select id from app_jobs where user_id=uid and status='pending' and created_at < now()-interval '10 minutes' loop
  perform fail_app_job(stale.id,'Generation interrupted. Your credit was returned.');
 end loop;
 select * into job from app_jobs where id=jid;
 if found then
  if job.user_id<>uid then raise exception 'Request ID unavailable'; end if;
  return job;
 end if;
 if exists(select 1 from app_jobs where user_id=uid and status='pending') then raise exception 'A app is already generating'; end if;
 if gid is not null and not exists(select 1 from created_apps where id=gid and user_id=uid) then raise exception 'App not found'; end if;
 select * into account from app_accounts where user_id=uid;
 if not account.unlimited and account.credits<1 then raise exception 'No credits remaining'; end if;
 if not account.unlimited then update app_accounts set credits=credits-1 where user_id=uid; end if;
 insert into app_jobs(id,user_id,app_id,prompt,charged) values(jid,uid,gid,instruction,not account.unlimited) returning * into job;
 return job;
end $$;
create function public.complete_app_job(jid uuid,app_title text,app_html text) returns void
language plpgsql security definer set search_path=public as $$
declare job app_jobs; gid uuid;
begin
 select * into job from app_jobs where id=jid for update;
 if job.status<>'pending' then return; end if;
 if job.app_id is null then
  insert into created_apps(user_id,title,html) values(job.user_id,app_title,app_html) returning id into gid;
 else
  gid:=job.app_id;
  update created_apps set title=app_title,html=app_html,revision=revision+1,updated_at=now() where id=gid and user_id=job.user_id;
 end if;
 update app_jobs set status='complete',app_id=gid where id=jid;
end $$;
revoke execute on function public.ensure_app_account(uuid),public.fail_app_job(uuid,text),public.reserve_app_job(uuid,uuid,uuid,text),public.complete_app_job(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ensure_app_account(uuid),public.fail_app_job(uuid,text),public.reserve_app_job(uuid,uuid,uuid,text),public.complete_app_job(uuid,text,text) to service_role;
