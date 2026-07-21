-- ============================================================================
-- Local Supabase compatibility shim (VERIFICATION ONLY — never applied to prod)
--
-- Hosted Supabase provides an `auth` schema, the anon/authenticated/service_role
-- roles, and auth.uid()/auth.role() helpers that read the request JWT. A stock
-- Postgres has none of these, so the migrations cannot execute without them.
--
-- These definitions mirror Supabase's own: auth.uid() and auth.role() read
-- `request.jwt.claims` from the session GUC, which is exactly how PostgREST
-- passes identity through. That means RLS policies behave here the way they
-- behave in production, and we can impersonate a user with:
--
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists btree_gist;
create extension if not exists postgis;
create extension if not exists pg_trgm;

-- ---------- Roles ----------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

-- ---------- auth schema ----------
create schema if not exists auth;

-- Minimal stand-in for auth.users (migrations FK against it).
-- Mirrors the columns the app's triggers actually read (handle_new_user reads
-- raw_user_meta_data->>'full_name').
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Supabase's definitions, verbatim in behaviour.
create or replace function auth.jwt() returns jsonb as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$ language sql stable;

create or replace function auth.uid() returns uuid as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$ language sql stable;

create or replace function auth.role() returns text as $$
  select coalesce(auth.jwt() ->> 'role', current_setting('role', true));
$$ language sql stable;

-- PostgREST grants schema usage to the request roles.
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
