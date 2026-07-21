-- iGlamHer — Migration 0017: account status lifecycle + preferences.
-- Run ONCE in the Supabase SQL Editor, AFTER 0016. Additive & idempotent.
begin;
do $$ begin create type public.account_status as enum ('active','paused','deactivated');
exception when duplicate_object then null; end $$;
alter table public.profiles
  add column if not exists account_status public.account_status not null default 'active',
  add column if not exists paused_until    timestamptz,
  add column if not exists deactivated_at  timestamptz,
  add column if not exists language        text not null default 'en',
  add column if not exists appearance      text not null default 'system';
create index if not exists profiles_account_status_idx on public.profiles (account_status) where account_status <> 'active';
commit;
-- Verify (expect 5 rows): account_status, appearance, deactivated_at, language, paused_until
select column_name from information_schema.columns where table_schema='public' and table_name='profiles'
  and column_name in ('account_status','paused_until','deactivated_at','language','appearance') order by column_name;
