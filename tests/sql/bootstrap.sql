-- Run only in an empty, disposable PostgreSQL database.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users (
 id uuid primary key,
 email text,
 email_confirmed_at timestamptz,
 raw_user_meta_data jsonb default '{}'
);
create function auth.uid() returns uuid language sql as $$
 select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
