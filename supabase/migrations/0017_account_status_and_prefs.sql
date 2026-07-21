-- Phase 14 — production account lifecycle + preferences.
-- account_status is the single source of truth for account state (never overload
-- is_active, which stays "published & visible in marketplace"). Additive &
-- idempotent. No data dropped.

do $$ begin
  create type public.account_status as enum
    ('active','paused','deactivated','deletion_pending','deleted','suspended');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists account_status        public.account_status not null default 'active',
  add column if not exists paused_at             timestamptz,
  add column if not exists pause_expires_at      timestamptz,
  add column if not exists deactivated_at        timestamptz,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deleted_at            timestamptz,
  add column if not exists anonymized_at         timestamptz,
  add column if not exists language              text not null default 'en',
  add column if not exists appearance            text not null default 'system';

create index if not exists profiles_account_status_idx
  on public.profiles (account_status) where account_status <> 'active';

-- Auto-reactivate paused accounts whose 30-day window has elapsed. Idempotent;
-- run on a schedule (pg_cron) and also enforced on read in the app layer.
create or replace function public.auto_reactivate_paused() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.profiles
     set account_status = 'active', paused_at = null, pause_expires_at = null
   where account_status = 'paused' and pause_expires_at is not null and pause_expires_at <= now();
  get diagnostics n = row_count;
  -- restore marketplace visibility for reactivated pros that were published
  update public.professional_profiles p
     set is_active = true
    from public.profiles pr
   where pr.id = p.user_id and pr.account_status = 'active'
     and p.review_status = 'approved' and p.is_active = false;
  return n;
end $$;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('auto-reactivate-paused', '0 * * * *', 'select public.auto_reactivate_paused();');
  end if;
end $$;
