-- Phase 14 — account settings: status lifecycle + preferences.
-- Additive & idempotent. No data dropped. Powers pause/deactivate/reactivate,
-- language, and appearance in the account settings screen.

do $$ begin create type public.account_status as enum ('active','paused','deactivated');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists account_status public.account_status not null default 'active',
  add column if not exists paused_until    timestamptz,
  add column if not exists deactivated_at  timestamptz,
  add column if not exists language        text not null default 'en',
  add column if not exists appearance      text not null default 'system';

create index if not exists profiles_account_status_idx on public.profiles (account_status)
  where account_status <> 'active';
